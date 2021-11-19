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
const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");

const webcam = require("./webcam");

printWithTimestamp(
  "oo[BOOT] Done loading the required dependencies/libraries."
);

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
  port.write(
    JSON.stringify({
      action: 2,
    })
  );
}, parseInt(process.env.SENSOR_OBTAINING_INTERVAL));

const port = new SerialPort(process.env.SERIAL_PORT, {
  baudRate: parseInt(process.env.SERIAL_BAUDRATE),
});
const parser = port.pipe(new Readline({ delimiter: "\r\n" }));

parser.on("data", (data) => {
  console.log(data);
  printWithTimestamp(`->${data}`);
  if (data.substring(0, 6) == "[COMD]") {
    let arduinoSettings = {
      ph: 6.2,
      light_intensity: 15422,
      nutrient_flow: 1.4,
      growth_light: false,
    };

    const arduinoSettingsJSON = JSON.stringify(arduinoSettings);
    printWithTimestamp(`<-${arduinoSettingsJSON}`);
    port.write(arduinoSettingsJSON);
  }

  if (data.substring(0, 6) == "[DATA]") {
    let dataFromArduino = JSON.parse(data.substring(7));
    webcam()
      .then((image) => {
        let dataRoutine = {
          token: process.env.DEVICE_TOKEN,
          temperature: dataFromArduino.temperature,
          humidity: dataFromArduino.humidity,
          ph: dataFromArduino.ph,
          light_intensity: dataFromArduino.light_intensity,
          nutrient_flow: dataFromArduino.nutrient_flow,
          nutrient_level: dataFromArduino.nutrient_level,
          acid_solution_level: dataFromArduino.acid_solution_level,
          base_solution_level: dataFromArduino.base_solution_level,
          tds: dataFromArduino.tds,
          ec: dataFromArduino.ec,
          image: image.substring(23),
        };

        printWithTimestamp("oo[MQTT] Transmitting data to the server...");
        mqttClient.publish(
          `smartfarmer/data/${process.env.DEVICE_TOKEN}`,
          JSON.stringify(dataRoutine)
        );
      })
      .catch(() => {});
  }
});

function printWithTimestamp(message) {
  const nowTime = new Date();
  const messageToPrint = `[${nowTime.toLocaleString()}] ${message}`;
  console.log(messageToPrint);
  fs.appendFile("log.txt", messageToPrint + "\r\n", null, () => {});
}
