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

let obtainSensorsDataIntervalId;
let gatherConfigIntervalId;
let refreshLampStateId;

gatherConfiguration();

var querystring = require("querystring");

async function gatherConfiguration() {
  const gatherConfigTimeStart = Date.now();

  Axios.post(`${process.env.API_URL}/agroclimate/device`, {
    device_token: process.env.DEVICE_TOKEN,
  })
    .then((response) => {
      const configReceivedTime = Date.now();
      const config = response.data;
      console.log(config);

      printWithTimestamp(
        `oo[CONF] The configuration obtained from the server successfully.`
      );
      printWithTimestamp(
        `oo[CONF] Config gathering started at ${gatherConfigTimeStart} and ended at ${configReceivedTime} with latency ${
          configReceivedTime - gatherConfigTimeStart
        } ms`
      );

      lastReceivedConfig =
        configReceivedTime - new Date(config.updatedAt).getTime();

      Axios.post(
        `${process.env.DEVICE_API_URL}/config`,
        querystring.stringify({
          ph: config.ph,
          light_intensity: config.light_intensity,
          nutrient_flow: config.nutrient_flow,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )
        .then((response) => {
          printWithTimestamp(
            `oo[CONF] The new configuration has sent to Arduino successfully.`
          );
          console.log(response.data);
        })
        .catch((err) => {
          printWithTimestamp(
            `oo[CONF] Failed to set the new configuration to Arduino. Error code: ${err.response.status} (${err.response.data}).`
          );
        });

      if (gatherConfigIntervalId != undefined)
        clearInterval(gatherConfigIntervalId);
      gatherConfiguration;

      gatherConfigIntervalId = setInterval(
        gatherConfiguration,
        config.refresh_time
      );

      if (refreshLampStateId != undefined) clearInterval(refreshLampStateId);

      refreshLampStateId = setInterval(() => {
        const CURRENT_DATE = new Date();
        let dayStart = new Date(config.day_start);
        dayStart.setFullYear(CURRENT_DATE.getFullYear());
        dayStart.setMonth(CURRENT_DATE.getMonth());
        dayStart.setDate(CURRENT_DATE.getDate());

        let dayEnd = new Date(config.day_end);
        dayEnd.setFullYear(CURRENT_DATE.getFullYear());
        dayEnd.setMonth(CURRENT_DATE.getMonth());
        dayEnd.setDate(CURRENT_DATE.getDate());

        Axios.get(
          `${process.env.DEVICE_API_URL}/light/${
            CURRENT_DATE > dayStart && CURRENT_DATE < dayEnd ? 1 : 0
          }`
        )
          .then((response) => {
            printWithTimestamp(
              `oo[CONF] The new lamp state has successfully sent (${
                CURRENT_DATE > dayStart && CURRENT_DATE < dayEnd ? "On" : "Off"
              }).`
            );
          })
          .catch((err) => {
            printWithTimestamp(
              `oo[CONF] Failed to set the new configuration to Arduino. Error code: ${err.response.status} (${err.response.data}).`
            );
          });
      }, process.env.LAMP_STATE_REFRESH_INTERVAL);

      if (obtainSensorsDataIntervalId != undefined)
        clearInterval(obtainSensorsDataIntervalId);

      obtainSensorsDataIntervalId = setInterval(() => {
        printWithTimestamp(
          "oo[HTTP] Obtaining the sensors data from Arduino..."
        );
        Axios.get(`${process.env.DEVICE_API_URL}/sensors`)
          .then((response) => {
            let dataRoutine = {
              ph: response.data.ph,
              light_intensity_inside: response.data.light_intensity_inside,
              light_intensity_outside: response.data.light_intensity_outside,
              nutrient_flow: response.data.nutrient_flow,
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
      }, parseInt(config.logging_time));
    })
    .catch((err) => {
      printWithTimestamp(
        `oo[CONF] Failed getting the agroclimate configuration from server. Error code: ${err.response.status} (${err.response.data}).`
      );
    });
}

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
