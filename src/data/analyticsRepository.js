const Click = require("../models/click");

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

function getThirtyDaysAgo(now = new Date()) {
  return new Date(now.getTime() - THIRTY_DAYS_IN_MS);
}

async function aggregateTotalClicks(slug) {
  const [result] = await Click.aggregate([
    { $match: { slug } },
    { $count: "totalClicks" },
  ]);

  return result ? result.totalClicks : 0;
}

async function aggregateClicksPerDay(slug, now = new Date()) {
  const thirtyDaysAgo = getThirtyDaysAgo(now);
  const results = await Click.aggregate([
    {
      $match: {
        slug,
        timestamp: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$timestamp",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id",
        count: 1,
      },
    },
  ]);

  return results;
}

async function aggregateTopReferrers(slug) {
  return Click.aggregate([
    {
      $match: {
        slug,
        referrer: { $ne: null },
      },
    },
    { $group: { _id: "$referrer", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        referrer: "$_id",
        count: 1,
      },
    },
  ]);
}

async function aggregateTopCountries(slug) {
  return Click.aggregate([
    {
      $match: {
        slug,
        country: { $ne: null },
      },
    },
    { $group: { _id: "$country", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $project: {
        _id: 0,
        country: "$_id",
        count: 1,
      },
    },
  ]);
}

module.exports = {
  aggregateTotalClicks,
  aggregateClicksPerDay,
  aggregateTopReferrers,
  aggregateTopCountries,
};
