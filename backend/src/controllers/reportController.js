import { getBadgeAssignmentReport } from '../models/sql/reportModel.js';

export const getBadgeReport = async (req, res) => {
  try {
    const { areaId, dateFrom, dateTo, nivelId, serviceLineId } = req.query || {};

    const rows = await getBadgeAssignmentReport({
      areaId,
      dateFrom,
      dateTo,
      nivelId,
      serviceLineId,
    });

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: error?.message || 'Failed to generate badge report.' });
  }
};
