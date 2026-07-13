import { SllLeaderSl } from './sql/SllLeaderSl.js';
import { ServiceLine } from './sql/ServiceLine.js';
import { LearningPath } from './sql/LearningPath.js';
import { Area } from './sql/Area.js';
import { Nivel } from './sql/Nivel.js';
import { NivelContemBadge } from './sql/NivelContemBadge.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

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

export const serviceLineLeaderModel = {
  async getMyServiceLine(accountId) {
    const slRows = await SllLeaderSl.findAll({
      where: { nutilizador: Number(accountId) },
      attributes: ['nsline'],
      order: [['nsline', 'ASC']],
    });

    const slIds = slRows.map((row) => row.nsline);
    if (slIds.length === 0) {
      return null;
    }

    const serviceLines = await ServiceLine.findAll({
      where: { nsline: slIds },
      include: [
        {
          model: LearningPath,
          as: 'learningPath',
        },
      ],
      order: [['nsline', 'ASC']],
    });

    const payload = [];

    for (const sl of serviceLines) {
      const lp = sl.learningPath;

      const areaRows = await Area.findAll({
        where: { nsline: sl.nsline },
        order: [['narea', 'ASC']],
      });

      const areaIds = areaRows.map((a) => a.narea);

      const levelRows = areaIds.length > 0
        ? await Nivel.findAll({
            where: { narea: areaIds },
            order: [['nnivel', 'ASC']],
          })
        : [];

      const levelIds = levelRows.map((l) => l.nnivel);
      const nivelBadgeRows = levelIds.length > 0
        ? await NivelContemBadge.findAll({
            where: { nnivel: levelIds },
            attributes: ['nnivel', 'nbadge'],
          })
        : [];

      const badgeMap = new Map();
      for (const row of nivelBadgeRows) {
        badgeMap.set(row.nnivel, row.nbadge);
      }

      const levelsByArea = levelRows.reduce((accumulator, level) => {
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
          badgeDbId: badgeMap.get(level.nnivel) || null,
          status: 'visualizar',
        });

        return accumulator;
      }, {});

      payload.push({
        id: `service-line-${sl.nsline}`,
        name: sl.sline,
        description: sl.sl_desc,
        image: sl.imagem || '/LP_BG.png',
        learningPath: {
          id: `learning-path-${lp.nlpath}`,
          name: lp.lpath,
          description: lp.lp_desc,
        },
        areas: areaRows.map((area) => ({
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
