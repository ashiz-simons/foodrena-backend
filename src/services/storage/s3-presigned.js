// api/src/services/storage/s3-presigned.js
const AWS = require('aws-sdk');
const { s3: s3config } = require('../../config');

const s3 = new AWS.S3({
  accessKeyId: s3config.accessKeyId,
  secretAccessKey: s3config.secretAccessKey,
  region: s3config.region,
  signatureVersion: 'v4'
});

function getPresignedPutUrl(key, contentType = 'application/octet-stream', expiresSeconds = 300) {
  const params = {
    Bucket: s3config.bucket,
    Key: key,
    Expires: expiresSeconds,
    ContentType: contentType,
    ACL: 'public-read'
  };
  return s3.getSignedUrlPromise('putObject', params);
}

module.exports = { getPresignedPutUrl };
