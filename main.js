const WebSocket = require("ws");
const mqtt = require("mqtt");

const connectMsg = { lang: "de_de", token: "", service: "connect" };
const serviceRealRequest = {
  lang: "de_de",
  token: "",
  dev_id: "1",
  service: "real",
  time123456: 1694529060729,
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
        processRealData(parsedData.result_data.list);
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
    serviceRealRequest.token = token;
    serviceRealRequest.time123456 = Date.now();
    wechselrichter.send(JSON.stringify(serviceRealRequest));
  };
}
connectWechselRichter();

const client = mqtt.connect("mqtt://192.168.178.44");

client.on("connect", () => {
  console.log("MQTT Connected");
});

const series = {
  data: [],
  add(entry) {
    if (this.data.length >= 20) {
      this.data.shift();
    }
    this.data.push(entry);
  },
};

const processRealData = (list) => {
  const map = {};
  list.forEach((entry) => {
    map[entry.data_name] = entry;
  });
  const data = {
    time: new Date().toISOString(),
  };
  Object.keys(fields).forEach((key) => {
    const fieldDef = fields[key];
    data[key] = {
      ...fieldDef,
      value: map[fieldDef.name].data_value,
      unit: map[fieldDef.name].data_unit,
    };
    console.log(fieldDef.display + ": " + map[fieldDef.name].data_value + map[fieldDef.name].data_unit);
  });

  client.publish("sungrow/data", JSON.stringify(data));
  series.add(data);
  client.publish("sungrow/hist_data", JSON.stringify(series));
  console.log("");
};
