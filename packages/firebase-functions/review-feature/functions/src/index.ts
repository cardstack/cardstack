import { https } from 'firebase-functions';

const REVIEW_FEATURE_ACTIVE = false;

exports.reviewFeature = https.onRequest(async (_, res) => {
  res.status(200).json({
    reviewActive: REVIEW_FEATURE_ACTIVE,
  });
});
