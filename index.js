const fs = require("fs");

if (!fs.existsSync("log.txt")) {
  const log = fs.openSync("log.txt", "w");
  fs.closeSync(log);
}

printWithTimestamp(
  "oo[BOOT] Smartfarmer software on Raspberry Pi 3B+ are ready to begin..."
);

require("dotenv").config();
const mqtt = require("mqtt");

printWithTimestamp(
  "oo[BOOT] Done loading the required dependencies/libraries."
);

const Axios = require("axios");
Axios.defaults.baseURL = process.env.DEVICE_API_URL;

let configuration = {};

gatherConfiguration();

async function gatherConfiguration() {
  configuration = await Axios.post(
    `${process.env.API_URL}/agroclimate/device`,
    {
      device_token: process.env.DEVICE_TOKEN,
    }
  ).catch((err) => {
    printWithTimestamp(
      `oo[CONF] Failed getting the agroclimate configuration from server. Error code: ${err.response.status} (${err.response.data}).`
    );
  });

  if (configuration == undefined) return;

  console.log(configuration.data);

  printWithTimestamp(
    "oo[CONF] Done getting the agroclimate configuration from server."
  );
}

const clientCert = fs.readFileSync("./certs/smartfarmer-client-raspi.cert.pem");
const clientKey = fs.readFileSync("./certs/smartfarmer-client-raspi.key");
const caFile = fs.readFileSync("./certs/root-ca.cert.pem");

printWithTimestamp("oo[BOOT] Done loading the required certificates.");

const mqttClient = mqtt.connect(
  `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
  {
    // rejectUnauthorized: false,
    // ca: [caFile],
    // key: clientKey,
    // cert: clientCert,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    // clientId: "friansh-" + Math.random().toString(16).substr(2, 8),
  }
);

mqttClient.on("connect", function () {
  printWithTimestamp(
    `oo[BOOT] Subscribed to MQTT topic "smartfarmer/feedback/${process.env.DEVICE_TOKEN}" and "smartfarmer/broadcast"`
  );
  mqttClient.subscribe(`smartfarmer/feedback/${process.env.DEVICE_TOKEN}`);
  mqttClient.subscribe("smartfarmer/broadcast");
});

mqttClient.on("message", function (topic, message) {
  let status;
  if (topic == "smartfarmer/broadcast") status = `[BROD] ${message.toString()}`;
  else status = `[MQRC] ${message.toString()}`;

  printWithTimestamp(status);
});

setInterval(() => {
  printWithTimestamp("oo[SERL] Obtaining the sensors data from Arduino...");
  Axios.get("/sensors")
    .then((response) => {
      let dataRoutine = {
        temperature: response.data.temperature,
        humidity: response.data.humidity,
        ph: response.data.ph,
        light_intensity: response.data.light_intensity,
        nutrient_flow: response.data.nutrient_flow,
        nutrient_level: response.data.nutrient_level,
        acid_solution_level: response.data.acid_solution_level,
        base_solution_level: response.data.base_solution_level,
        tds: response.data.tds,
        ec: response.data.ec,
        sent: Date.now(),
      };

      printWithTimestamp("oo[MQTT] Transmitting data to the server...");
      mqttClient.publish(
        `smartfarmer/data/${process.env.DEVICE_TOKEN}`,
        JSON.stringify(dataRoutine)
      );
    })
    .catch((error) => {
      console.log(error.response);
    });
}, parseInt(process.env.SENSOR_OBTAINING_INTERVAL));

/*
  console.log(data);
  printWithTimestamp(`->${data}`);
  if (data.substring(0, 6) == "[COMD]") {
    if (configuration == {}) return;

    let arduinoSettings = {
      ph: configuration.ph,
      light_intensity: configuration.light_intensity,
      nutrient_flow: configuration.nutrient_flow,
      growth_light: false,
    };

    const arduinoSettingsJSON = JSON.stringify(arduinoSettings);
    printWithTimestamp(`<-${arduinoSettingsJSON}`);
    port.write(arduinoSettingsJSON);
  }


  }
*/

function printWithTimestamp(message) {
  const nowTime = new Date();
  const messageToPrint = `[${nowTime.toLocaleString()}] ${message}`;
  console.log(messageToPrint);
  fs.appendFile("log.txt", messageToPrint + "\r\n", null, () => {});
}
