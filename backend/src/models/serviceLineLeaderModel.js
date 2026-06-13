import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const badgeImages = [
  '/badges/J%C3%BAnior.png',
  '/badges/Interm%C3%A9dio.png',
  '/badges/S%C3%A9nior.png',
  '/badges/Especialista.png',
  '/badges/L%C3%ADder%20de%20Conhecimento.png',
];

const badgePoints = [100, 150, 200, 250, 300];

const badgeLevelTemplates = [
  {
    levelKey: 'badge_level_junior',
    points: 100,
    badgeImage: '/badges/J%C3%BAnior.png',
  },
  {
    levelKey: 'badge_level_intermediate',
    points: 150,
    badgeImage: '/badges/Interm%C3%A9dio.png',
  },
  {
    levelKey: 'badge_level_senior',
    points: 200,
    badgeImage: '/badges/S%C3%A9nior.png',
  },
  {
    levelKey: 'badge_level_specialist',
    points: 250,
    badgeImage: '/badges/Especialista.png',
  },
  {
    levelKey: 'badge_level_knowledge_lead',
    points: 300,
    badgeImage: '/badges/L%C3%ADder%20de%20Conhecimento.png',
  },
];

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []);

export const serviceLineLeaderModel = {
  async getMyServiceLine(accountId) {
    const serviceLineRows = normalizeRows(
      await sequelize.query(
      `
        SELECT
          sl.nsline,
          sl.sline,
          sl.sl_desc,
          sl.imagem AS sl_image,
          lp.nlpath,
          lp.lpath,
          lp.lp_desc
        FROM utilizador AS u
        INNER JOIN sll_leader_sl AS sll
          ON sll.nutilizador = u.nutilizador
        INNER JOIN service_line AS sl
          ON sl.nsline = sll.nsline
        INNER JOIN learning_path AS lp
          ON lp.nlpath = sl.nlpath
        WHERE u.nutilizador = :accountId
        ORDER BY sl.nsline ASC
      `,
        {
          replacements: { accountId: Number(accountId) },
          type: QueryTypes.SELECT,
        },
      ),
    );

    if (serviceLineRows.length === 0) {
      return null;
    }

    const payload = [];

    for (const serviceLineRow of serviceLineRows) {
      const areas = normalizeRows(
        await sequelize.query(
          `
            SELECT
              a.narea,
              a.area,
              a.a_desc
            FROM area AS a
            WHERE a.nsline = :serviceLineId
            ORDER BY a.narea ASC
          `,
          {
            replacements: { serviceLineId: serviceLineRow.nsline },
            type: QueryTypes.SELECT,
          },
        ),
      );

      const levels = normalizeRows(
        await sequelize.query(
          `
            SELECT
              n.nnivel,
              n.nivel,
              n.narea
            FROM nivel AS n
            INNER JOIN area AS a
              ON a.narea = n.narea
            WHERE a.nsline = :serviceLineId
            ORDER BY n.nnivel ASC
          `,
          {
            replacements: { serviceLineId: serviceLineRow.nsline },
            type: QueryTypes.SELECT,
          },
        ),
      );

      const levelsByArea = levels.reduce((accumulator, level) => {
        const key = Number(level.narea);
        if (!accumulator[key]) {
          accumulator[key] = [];
        }

        const position = accumulator[key].length;
        const template = badgeLevelTemplates[position % badgeLevelTemplates.length];
        const rawTitle = String(level.nivel || '').trim();
        const title = rawTitle.includes(' - ') ? rawTitle.split(' - ').slice(1).join(' - ') : rawTitle;

        accumulator[key].push({
          id: `nivel-${level.nnivel}`,
          title,
          subtitle: `Nivel ${position + 1}`,
          levelKey: template.levelKey,
          points: template.points,
          badgeImage: template.badgeImage,
          status: 'visualizar',
        });

        return accumulator;
      }, {});

      payload.push({
        id: `service-line-${serviceLineRow.nsline}`,
        name: serviceLineRow.sline,
        description: serviceLineRow.sl_desc,
        image: serviceLineRow.sl_image || '/LP_BG.png',
        learningPath: {
          id: `learning-path-${serviceLineRow.nlpath}`,
          name: serviceLineRow.lpath,
          description: serviceLineRow.lp_desc,
        },
        areas: areas.map((area) => ({
          id: `area-${area.narea}`,
          name: area.area,
          description: area.a_desc,
          levels: levelsByArea[Number(area.narea)] || [],
        })),
      });
    }

    return clone(payload);
  },
};
