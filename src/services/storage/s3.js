const AWS = require('aws-sdk');
const { s3: s3config } = require('../../config');

const s3 = new AWS.S3({ accessKeyId: s3config.accessKeyId, secretAccessKey: s3config.secretAccessKey, region: s3config.region });

async function uploadBuffer(buffer, key, contentType) {
  const res = await s3.upload({ Bucket: s3config.bucket, Key: key, Body: buffer, ContentType: contentType, ACL: 'public-read' }).promise();
  return res.Location;
}

module.exports = { uploadBuffer };
