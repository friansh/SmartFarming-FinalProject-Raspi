const NodeWebcam = require("node-webcam");
const Jimp = require("jimp");
const util = require("util");

var opts = {
  width: 1280,
  height: 720,
  quality: 100,
  output: "jpeg",
  callbackReturn: "buffer",
};

async function getWebcamFeed() {
  const nwCapture = util.promisify(NodeWebcam.capture).bind(NodeWebcam);
  const rawImage = await nwCapture("webcam_feed", opts).catch(() => {});

  if (!rawImage) {
    throw new Error("camera error");
  }

  const image = await Jimp.read(rawImage);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

  const datetimeLabel = new Date();

  await image
    .print(
      font,
      10,
      -5,
      {
        text: datetimeLabel.toLocaleString(),
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
      },
      image.bitmap.width,
      image.bitmap.height
    )
    .print(
      font,
      -10,
      -5,
      {
        text: "Smart Farming Feeds",
        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT,
        alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
      },
      image.bitmap.width,
      image.bitmap.height
    );

  const getBase64 = util.promisify(image.getBase64).bind(image);
  const processedImage = getBase64(Jimp.MIME_JPEG);

  return processedImage;
}

module.exports = getWebcamFeed;
