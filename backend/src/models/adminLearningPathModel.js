import { QueryTypes, Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { LearningPath } from './sql/LearningPath.js';
import { ServiceLine } from './sql/ServiceLine.js';
import { Area } from './sql/Area.js';
import { Nivel } from './sql/Nivel.js';

const buildLearningPathTree = (rows) => {
  const learningPathMap = new Map();
  const serviceLineMap = new Map();
  const areaMap = new Map();

  rows.forEach((row) => {
    const pathId = Number(row?.nlpath);
    if (!Number.isInteger(pathId) || pathId <= 0) {
      return;
    }

    const pathKey = `learning-path-${pathId}`;

    if (!learningPathMap.has(pathKey)) {
      learningPathMap.set(pathKey, {
        id: pathKey,
        name: row.lpath,
        description: row.lp_desc,
        isActive: Boolean(row.lp_is_active),
        serviceLines: [],
      });
    }

    const learningPath = learningPathMap.get(pathKey);
    const serviceLineId = Number(row?.nsline);

    if (!Number.isInteger(serviceLineId) || serviceLineId <= 0) {
      return;
    }

    const serviceLineKey = `service-line-${serviceLineId}`;
    const serviceLineMapKey = `${pathKey}:${serviceLineKey}`;
    let serviceLine = serviceLineMap.get(serviceLineMapKey);

    if (!serviceLine) {
      serviceLine = {
        id: serviceLineKey,
        name: row.sline,
        description: row.sl_desc,
        isActive: Boolean(row.sl_is_active),
        image: row.sl_image || '/LP_BG.png',
        areas: [],
      };

      learningPath.serviceLines.push(serviceLine);
      serviceLineMap.set(serviceLineMapKey, serviceLine);
    }

    const areaId = Number(row?.narea);
    if (!Number.isInteger(areaId) || areaId <= 0) {
      return;
    }

    const areaKey = `area-${areaId}`;
    const areaMapKey = `${serviceLineMapKey}:${areaKey}`;
    let area = areaMap.get(areaMapKey);

    if (!area) {
      area = {
        id: areaKey,
        name: row.area,
        description: row.a_desc,
        isActive: Boolean(row.a_is_active),
        levels: [],
      };

      serviceLine.areas.push(area);
      areaMap.set(areaMapKey, area);
    }

    const levelId = Number(row?.nnivel);
    if (!Number.isInteger(levelId) || levelId <= 0) {
      return;
    }

    const title = String(row?.nivel || '').trim();
    area.levels.push({
      id: `nivel-${levelId}`,
      title,
      isActive: Boolean(row.n_is_active),
      subtitle: `Nivel ${area.levels.length + 1}`,
      badgeCount: Number(row.badge_count) || 0,
    });
  });

  return Array.from(learningPathMap.values());
};

const recordExists = async (Model, id) => {
  const count = await Model.count({ where: { [Model.primaryKeyAttribute]: Number(id) } });
  return count > 0;
};

export const adminLearningPathModel = {
  async listLearningPaths() {
    const rows = await sequelize.query(
      `
        SELECT
          lp.nlpath,
          lp.lpath,
          lp.lp_desc,
          lp.is_active AS lp_is_active,
          sl.nsline,
          sl.sline,
          sl.sl_desc,
          sl.imagem AS sl_image,
          sl.is_active AS sl_is_active,
          a.narea,
          a.area,
          a.a_desc,
          a.is_active AS a_is_active,
          n.nnivel,
          n.nivel,
          n.is_active AS n_is_active,
          COALESCE(nbc.badge_count, 0) AS badge_count
        FROM learning_path AS lp
        LEFT JOIN service_line AS sl
          ON sl.nlpath = lp.nlpath
        LEFT JOIN area AS a
          ON a.nsline = sl.nsline
        LEFT JOIN nivel AS n
          ON n.narea = a.narea
        LEFT JOIN (
          SELECT nnivel, COUNT(DISTINCT nbadge) AS badge_count
          FROM nivel_contem_b
          GROUP BY nnivel
        ) AS nbc
          ON nbc.nnivel = n.nnivel
        ORDER BY lp.nlpath ASC, sl.nsline ASC, a.narea ASC, n.nnivel ASC
      `,
      { type: QueryTypes.SELECT },
    );

    return buildLearningPathTree(rows || []);
  },

  async createLearningPath({ name, description }) {
    const row = await LearningPath.create({
      lpath: name,
      lp_desc: description,
    }, { returning: true, raw: true });

    return row || null;
  },

  async updateLearningPath({ learningPathId, name, description }) {
    const [updated] = await LearningPath.update(
      { lpath: name, lp_desc: description },
      { where: { nlpath: learningPathId }, returning: true },
    );
    if (!updated) return null;
    const row = await LearningPath.findByPk(learningPathId, { raw: true });
    return row || null;
  },

  async createServiceLine({ learningPathId, name, description, image }) {
    const row = await ServiceLine.create({
      sline: name,
      sl_desc: description,
      imagem: image,
      nlpath: learningPathId,
    }, { returning: true, raw: true });

    return row || null;
  },

  async updateServiceLine({ serviceLineId, name, description, image }) {
    const [updated] = await ServiceLine.update(
      { sline: name, sl_desc: description, imagem: image },
      { where: { nsline: serviceLineId }, returning: true },
    );
    if (!updated) return null;
    const row = await ServiceLine.findByPk(serviceLineId, { raw: true });
    return row || null;
  },

  async createArea({ serviceLineId, name, description }) {
    const row = await Area.create({
      area: name,
      a_desc: description,
      nsline: serviceLineId,
    }, { returning: true, raw: true });

    return row || null;
  },

  async updateArea({ areaId, name, description }) {
    const [updated] = await Area.update(
      { area: name, a_desc: description },
      { where: { narea: areaId }, returning: true },
    );
    if (!updated) return null;
    const row = await Area.findByPk(areaId, { raw: true });
    return row || null;
  },

  async createLevel({ areaId, title }) {
    const row = await Nivel.create({
      nivel: title,
      narea: areaId,
    }, { returning: true, raw: true });

    return row || null;
  },

  async updateLevel({ levelId, title }) {
    const [updated] = await Nivel.update(
      { nivel: title },
      { where: { nnivel: levelId }, returning: true },
    );
    if (!updated) return null;
    const row = await Nivel.findByPk(levelId, { raw: true });
    return row || null;
  },

  async updateLearningPathStatus({ learningPathId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [updated] = await LearningPath.update(
        { is_active: targetStatus },
        { where: { nlpath: learningPathId }, returning: true, transaction },
      );

      if (!updated) {
        return null;
      }

      const row = await LearningPath.findByPk(learningPathId, { raw: true, transaction });

      await ServiceLine.update(
        { is_active: targetStatus },
        { where: { nlpath: learningPathId }, transaction },
      );

      await Area.update(
        { is_active: targetStatus },
        {
          where: {
            nsline: { [Op.in]: sequelize.literal('(SELECT nsline FROM service_line WHERE nlpath = ' + Number(learningPathId) + ')') },
          },
          transaction,
        },
      );

      await Nivel.update(
        { is_active: targetStatus },
        {
          where: {
            narea: { [Op.in]: sequelize.literal('(SELECT a.narea FROM area AS a INNER JOIN service_line AS sl ON sl.nsline = a.nsline WHERE sl.nlpath = ' + Number(learningPathId) + ')') },
          },
          transaction,
        },
      );

      return row;
    });
  },

  async updateServiceLineStatus({ serviceLineId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [updated] = await ServiceLine.update(
        { is_active: targetStatus },
        { where: { nsline: serviceLineId }, returning: true, transaction },
      );

      if (!updated) {
        return null;
      }

      const row = await ServiceLine.findByPk(serviceLineId, { raw: true, transaction });

      if (targetStatus) {
        await LearningPath.update(
          { is_active: true },
          { where: { nlpath: Number(row.nlpath) }, transaction },
        );
      }

      await Area.update(
        { is_active: targetStatus },
        { where: { nsline: serviceLineId }, transaction },
      );

      await Nivel.update(
        { is_active: targetStatus },
        {
          where: {
            narea: { [Op.in]: sequelize.literal('(SELECT narea FROM area WHERE nsline = ' + Number(serviceLineId) + ')') },
          },
          transaction,
        },
      );

      return row;
    });
  },

  async updateAreaStatus({ areaId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [updated] = await Area.update(
        { is_active: targetStatus },
        { where: { narea: areaId }, returning: true, transaction },
      );

      if (!updated) {
        return null;
      }

      const row = await Area.findByPk(areaId, { raw: true, transaction });

      if (targetStatus) {
        await ServiceLine.update(
          { is_active: true },
          { where: { nsline: Number(row.nsline) }, transaction },
        );

        await LearningPath.update(
          { is_active: true },
          {
            where: {
              nlpath: { [Op.in]: sequelize.literal('(SELECT nlpath FROM service_line WHERE nsline = ' + Number(row.nsline) + ')') },
            },
            transaction,
          },
        );
      }

      await Nivel.update(
        { is_active: targetStatus },
        { where: { narea: areaId }, transaction },
      );

      return row;
    });
  },

  async updateLevelStatus({ levelId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [updated] = await Nivel.update(
        { is_active: targetStatus },
        { where: { nnivel: levelId }, returning: true, transaction },
      );

      if (!updated) {
        return null;
      }

      const row = await Nivel.findByPk(levelId, { raw: true, transaction });

      if (targetStatus) {
        await Area.update(
          { is_active: true },
          { where: { narea: Number(row.narea) }, transaction },
        );

        await ServiceLine.update(
          { is_active: true },
          {
            where: {
              nsline: { [Op.in]: sequelize.literal('(SELECT nsline FROM area WHERE narea = ' + Number(row.narea) + ')') },
            },
            transaction,
          },
        );

        await LearningPath.update(
          { is_active: true },
          {
            where: {
              nlpath: { [Op.in]: sequelize.literal('(SELECT sl.nlpath FROM service_line AS sl INNER JOIN area AS a ON a.nsline = sl.nsline WHERE a.narea = ' + Number(row.narea) + ')') },
            },
            transaction,
          },
        );
      }

      return row;
    });
  },

  async hasLearningPath(learningPathId) {
    return recordExists(LearningPath, learningPathId);
  },

  async hasServiceLine(serviceLineId) {
    return recordExists(ServiceLine, serviceLineId);
  },

  async hasArea(areaId) {
    return recordExists(Area, areaId);
  },

  async hasLevel(levelId) {
    return recordExists(Nivel, levelId);
  },
};
