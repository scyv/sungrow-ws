const WebSocket = require("ws");
const mqtt = require("mqtt");

const connectMsg = { lang: "de_de", token: "", service: "connect" };
const serviceRequest = {
  lang: "de_de",
  token: "",
  dev_id: "1",
  service: "",
  time123456: 0,
};

const fields = {
  verbrauch: {
    name: "I18N_COMMON_LOAD_TOTAL_ACTIVE_POWER",
    display: "Verbrauch",
  },
  einspeisung: {
    name: "I18N_COMMON_FEED_NETWORK_TOTAL_ACTIVE_POWER",
    display: "Einspeisung",
  },
  einspeisung_gesamt: {
    name: "I18N_COMMON_TOTAL_FEED_NETWORK_VOLUME",
    display: "Einspeisung gesamt",
  },
  netzbezug: {
    name: "I18N_CONFIG_KEY_4060",
    display: "Netzbezug",
  },
  pvleistung: {
    name: "I18N_COMMON_TOTAL_DCPOWER",
    display: "PV-Leistung",
  },
  pvleistung_bezogen: {
    name: "I18N_COMMON_TOTAL_DIRECT_POWER_CONSUMPTION_PV",
    display: "PV-Leistung gesamt bezogen",
  },
};

let loggedIn = false;
let token = "";
let wrdata = {};
let pvleistungMax = 0;

function connectWechselRichter() {
  const wechselrichter = new WebSocket("ws://192.168.178.82:8082/ws/home/overview");
  wechselrichter.on("open", () => {
    console.log("Verbindung hergestellt.");
    wechselrichter.send(JSON.stringify(connectMsg));
  });

  wechselrichter.on("message", (data) => {
    const parsedData = JSON.parse(data);

    /* login response
     {
    "result_code":	1,
    "result_msg":	"success",
    "result_data":	{
        "service":	"connect",
        "token":	"f1a23e12-3772-40dc-8f22-a8117c71310a",
        "uid":	1,
        "tips_disable":	0
    }
}*/

    if (loggedIn) {
      if (parsedData.result_data && parsedData.result_data.service === "real") {
        wrdata = {
          ...wrdata,
          ...processRealData(parsedData.result_data.list),
        };
        pvleistungMax = Math.max(pvleistungMax, parseFloat(wrdata["pvleistung"].value));
        wrdata = {
          ...wrdata,
          pvleistungTagesMax: {
            name: "pvleistungTagesMax",
            display: "PV-Leistung Tagesmax",
            value: pvleistungMax.toFixed(2),
            unit: wrdata["pvleistung"].unit,
          },
        };
      }
      if (parsedData.result_data && parsedData.result_data.service === "direct") {
        wrdata = {
          ...wrdata,
          ...processDirectData(parsedData.result_data.list),
        };
      }

      setTimeout(() => {
        startDataRequest();
      }, 7000);
    } else {
      if (parsedData.result_msg === "success") {
        console.log("Logged in");
        token = parsedData.result_data.token;
        loggedIn = true;
        startDataRequest();
      } else {
        console.log("Fehler bei Login. Versuche es nochmal in 10 Sekunden");
        setTimeout(() => {
          wechselrichter.send(JSON.stringify(connectMsg));
        }, 10000);
      }
    }
  });

  wechselrichter.on("close", () => {
    console.log("Verbindung geschlossen.");
    setTimeout(() => {
      connectWechselRichter();
    }, 5000);
  });

  wechselrichter.on("error", (error) => {
    console.error("Fehler bei der Verbindung:", error);
  });
  const startDataRequest = () => {
    const realDataRequest = {
      ...serviceRequest,
      service: "real",
      token: token,
      time123456: Date.now(),
    };
    const directDataRequest = {
      ...serviceRequest,
      service: "direct",
      token: token,
      time123456: Date.now(),
    };
    wechselrichter.send(JSON.stringify(realDataRequest));
    wechselrichter.send(JSON.stringify(directDataRequest));
  };
}

const client = mqtt.connect("mqtt://192.168.178.44");

client.on("connect", () => {
  console.log("MQTT Connected");
});

const series = {
  data: [],
  lastAdded: 0,
  add(entry) {
    if (Date.now() - 60 * 1000 < this.lastAdded) {
      return false;
    }
    this.lastAdded = Date.now();
    if (this.data.length >= 20) {
      this.data.shift();
    }
    this.data.push(entry);
    return true;
  },
};

const logData = () => {
  console.log("-- " + wrdata.time + " --");
  Object.keys(wrdata).forEach((key) => {
    const entry = wrdata[key];
    if (!entry.display) {
      return;
    }
    console.log(entry.display + ": " + entry.value + entry.unit);
  });
  console.log("");
};

const publishData = () => {
  wrdata.time = new Date().toString();
  logData();
  client.publish("sungrow/data", JSON.stringify(wrdata));
  if (series.add(wrdata)) {
    client.publish("sungrow/hist_data", JSON.stringify({ data: series.data }));
  }
  setTimeout(() => {
    publishData();
  }, 5000);
};

const processRealData = (list) => {
  const map = {};
  list.forEach((entry) => {
    map[entry.data_name] = entry;
  });
  const data = {};
  Object.keys(fields).forEach((key) => {
    const fieldDef = fields[key];
    data[key] = {
      ...fieldDef,
      value: map[fieldDef.name].data_value,
      unit: map[fieldDef.name].data_unit,
    };
  });
  return data;
};

/*
 direct response
{
	"result_code":	1,
	"result_msg":	"success",
	"result_data":	{
		"service":	"direct",
		"list":	[{
				"name":	"MPPT1",
				"voltage":	"313.9",
				"voltage_unit":	"V",
				"current":	"10.5",
				"current_unit":	"A"
			}, {
				"name":	"MPPT2",
				"voltage":	"226.7",
				"voltage_unit":	"V",
				"current":	"0.0",
				"current_unit":	"A"
			}, {
				"name":	"I18N_COMMON_GROUP_BUNCH_TITLE_AND%@1",
				"voltage":	"313.6",
				"voltage_unit":	"V",
				"current":	"10.50",
				"current_unit":	"A"
			}, {
				"name":	"I18N_COMMON_GROUP_BUNCH_TITLE_AND%@2",
				"voltage":	"226.7",
				"voltage_unit":	"V",
				"current":	"0.00",
				"current_unit":	"A"
			}],
		"count":	4
	}
}
*/
const processDirectData = (list) => {
  const map = {};
  list.forEach((entry) => {
    map[entry.name] = entry;
  });

  const mppt1Max = 10 * 0.435;
  const mppt2Max = 15 * 0.435;

  const data = {
    mppt1_leistung: {
      name: "MPPT1",
      display: "Leistung MPPT1",
      value: ((parseFloat(map["MPPT1"].voltage) * parseFloat(map["MPPT1"].current)) / 1000).toFixed(2),
      unit: "kW",
    },
    mppt2_leistung: {
      name: "MPPT2",
      display: "Leistung MPPT2",
      value: ((parseFloat(map["MPPT2"].voltage) * parseFloat(map["MPPT2"].current)) / 1000).toFixed(2),
      unit: "kW",
    },
    mppt1_leistung_anteil: {
      name: "MPPT1_PROZ",
      display: "Leistung Anteil MPPT1",
      value: (((parseFloat(map["MPPT1"].voltage) * parseFloat(map["MPPT1"].current)) / 1000 / mppt1Max) * 100).toFixed(
        0
      ),
      unit: "%",
    },
    mppt2_leistung_anteil: {
      name: "MPPT2_PROZ",
      display: "Leistung Anteil MPPT2",
      value: (((parseFloat(map["MPPT2"].voltage) * parseFloat(map["MPPT2"].current)) / 1000 / mppt2Max) * 100).toFixed(
        0
      ),
      unit: "%",
    },
  };
  return data;
};

connectWechselRichter();
publishData();
