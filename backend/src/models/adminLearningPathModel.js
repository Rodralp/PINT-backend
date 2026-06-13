import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

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

const recordExists = async (query, id) => {
  const [row] = await sequelize.query(query, {
    replacements: { id: Number(id) },
    type: QueryTypes.SELECT,
  });
  return Boolean(row);
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
    const [row] = await sequelize.query(
      `
        INSERT INTO learning_path (lpath, lp_desc)
        VALUES (:name, :description)
        RETURNING nlpath, lpath, lp_desc, is_active
      `,
      {
        replacements: { name, description },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async updateLearningPath({ learningPathId, name, description }) {
    const [row] = await sequelize.query(
      `
        UPDATE learning_path
        SET lpath = :name,
            lp_desc = :description
        WHERE nlpath = :learningPathId
        RETURNING nlpath, lpath, lp_desc, is_active
      `,
      {
        replacements: { learningPathId, name, description },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async createServiceLine({ learningPathId, name, description, image }) {
    const [row] = await sequelize.query(
      `
        INSERT INTO service_line (sline, sl_desc, imagem, nlpath)
        VALUES (:name, :description, :image, :learningPathId)
        RETURNING nsline, sline, sl_desc, imagem, nlpath, is_active
      `,
      {
        replacements: { name, description, image, learningPathId },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async updateServiceLine({ serviceLineId, name, description, image }) {
    const [row] = await sequelize.query(
      `
        UPDATE service_line
        SET sline = :name,
            sl_desc = :description,
            imagem = :image
        WHERE nsline = :serviceLineId
        RETURNING nsline, sline, sl_desc, imagem, nlpath, is_active
      `,
      {
        replacements: { serviceLineId, name, description, image },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async createArea({ serviceLineId, name, description }) {
    const [row] = await sequelize.query(
      `
        INSERT INTO area (area, a_desc, nsline)
        VALUES (:name, :description, :serviceLineId)
        RETURNING narea, area, a_desc, nsline, is_active
      `,
      {
        replacements: { name, description, serviceLineId },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async updateArea({ areaId, name, description }) {
    const [row] = await sequelize.query(
      `
        UPDATE area
        SET area = :name,
            a_desc = :description
        WHERE narea = :areaId
        RETURNING narea, area, a_desc, nsline, is_active
      `,
      {
        replacements: { areaId, name, description },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async createLevel({ areaId, title }) {
    const [row] = await sequelize.query(
      `
        INSERT INTO nivel (nivel, narea)
        VALUES (:title, :areaId)
        RETURNING nnivel, nivel, narea, is_active
      `,
      {
        replacements: { title, areaId },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async updateLevel({ levelId, title }) {
    const [row] = await sequelize.query(
      `
        UPDATE nivel
        SET nivel = :title
        WHERE nnivel = :levelId
        RETURNING nnivel, nivel, narea, is_active
      `,
      {
        replacements: { levelId, title },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  },

  async updateLearningPathStatus({ learningPathId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query(
        `
          UPDATE learning_path
          SET is_active = :isActive
          WHERE nlpath = :learningPathId
          RETURNING nlpath, lpath, lp_desc, is_active
        `,
        {
          replacements: { learningPathId, isActive: targetStatus },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (!row) {
        return null;
      }

      await sequelize.query(
        `
          UPDATE service_line
          SET is_active = :targetStatus
          WHERE nlpath = :learningPathId
        `,
        {
          replacements: { learningPathId, targetStatus },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );

      await sequelize.query(
        `
          UPDATE area
          SET is_active = :targetStatus
          WHERE nsline IN (
            SELECT nsline
            FROM service_line
            WHERE nlpath = :learningPathId
          )
        `,
        {
          replacements: { learningPathId, targetStatus },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );

      await sequelize.query(
        `
          UPDATE nivel
          SET is_active = :targetStatus
          WHERE narea IN (
            SELECT a.narea
            FROM area AS a
            INNER JOIN service_line AS sl
              ON sl.nsline = a.nsline
            WHERE sl.nlpath = :learningPathId
          )
        `,
        {
          replacements: { learningPathId, targetStatus },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );

      return row;
    });
  },

  async updateServiceLineStatus({ serviceLineId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query(
        `
          UPDATE service_line
          SET is_active = :isActive
          WHERE nsline = :serviceLineId
          RETURNING nsline, sline, sl_desc, imagem, nlpath, is_active
        `,
        {
          replacements: { serviceLineId, isActive: targetStatus },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (!row) {
        return null;
      }

      if (targetStatus) {
        await sequelize.query(
          `
            UPDATE learning_path
            SET is_active = TRUE
            WHERE nlpath = :learningPathId
          `,
          {
            replacements: { learningPathId: Number(row.nlpath) },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }

      await sequelize.query(
        `
          UPDATE area
          SET is_active = :targetStatus
          WHERE nsline = :serviceLineId
        `,
        {
          replacements: { serviceLineId, targetStatus },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );

      await sequelize.query(
        `
          UPDATE nivel
          SET is_active = :targetStatus
          WHERE narea IN (
            SELECT narea
            FROM area
            WHERE nsline = :serviceLineId
          )
        `,
        {
          replacements: { serviceLineId, targetStatus },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );

      return row;
    });
  },

  async updateAreaStatus({ areaId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query(
        `
          UPDATE area
          SET is_active = :isActive
          WHERE narea = :areaId
          RETURNING narea, area, a_desc, nsline, is_active
        `,
        {
          replacements: { areaId, isActive: targetStatus },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (!row) {
        return null;
      }

      if (targetStatus) {
        await sequelize.query(
          `
            UPDATE service_line
            SET is_active = TRUE
            WHERE nsline = :serviceLineId
          `,
          {
            replacements: { serviceLineId: Number(row.nsline) },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );

        await sequelize.query(
          `
            UPDATE learning_path
            SET is_active = TRUE
            WHERE nlpath = (
              SELECT nlpath
              FROM service_line
              WHERE nsline = :serviceLineId
            )
          `,
          {
            replacements: { serviceLineId: Number(row.nsline) },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }

      await sequelize.query(
        `
          UPDATE nivel
          SET is_active = :targetStatus
          WHERE narea = :areaId
        `,
        {
          replacements: { areaId, targetStatus },
          type: QueryTypes.UPDATE,
          transaction,
        },
      );

      return row;
    });
  },

  async updateLevelStatus({ levelId, isActive }) {
    const targetStatus = Boolean(isActive);

    return sequelize.transaction(async (transaction) => {
      const [row] = await sequelize.query(
        `
          UPDATE nivel
          SET is_active = :isActive
          WHERE nnivel = :levelId
          RETURNING nnivel, nivel, narea, is_active
        `,
        {
          replacements: { levelId, isActive: targetStatus },
          type: QueryTypes.SELECT,
          transaction,
        },
      );

      if (!row) {
        return null;
      }

      if (targetStatus) {
        await sequelize.query(
          `
            UPDATE area
            SET is_active = TRUE
            WHERE narea = :areaId
          `,
          {
            replacements: { areaId: Number(row.narea) },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );

        await sequelize.query(
          `
            UPDATE service_line
            SET is_active = TRUE
            WHERE nsline = (
              SELECT nsline
              FROM area
              WHERE narea = :areaId
            )
          `,
          {
            replacements: { areaId: Number(row.narea) },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );

        await sequelize.query(
          `
            UPDATE learning_path
            SET is_active = TRUE
            WHERE nlpath = (
              SELECT sl.nlpath
              FROM service_line AS sl
              INNER JOIN area AS a
                ON a.nsline = sl.nsline
              WHERE a.narea = :areaId
            )
          `,
          {
            replacements: { areaId: Number(row.narea) },
            type: QueryTypes.UPDATE,
            transaction,
          },
        );
      }

      return row;
    });
  },

  async hasLearningPath(learningPathId) {
    return recordExists(
      'SELECT 1 FROM learning_path WHERE nlpath = :id LIMIT 1',
      learningPathId,
    );
  },

  async hasServiceLine(serviceLineId) {
    return recordExists(
      'SELECT 1 FROM service_line WHERE nsline = :id LIMIT 1',
      serviceLineId,
    );
  },

  async hasArea(areaId) {
    return recordExists('SELECT 1 FROM area WHERE narea = :id LIMIT 1', areaId);
  },

  async hasLevel(levelId) {
    return recordExists('SELECT 1 FROM nivel WHERE nnivel = :id LIMIT 1', levelId);
  },
};
