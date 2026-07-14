import { Account } from './Account.js';
import { Team, TeamMember } from './Team.js';
import { Reminder } from './Reminder.js';
import { LearningPath } from './LearningPath.js';
import { ServiceLine } from './ServiceLine.js';
import { Area } from './Area.js';
import { Tipo } from './Tipo.js';
import { Badge } from './Badge.js';
import { Nivel } from './Nivel.js';
import { BadgePertenceArea } from './BadgePertenceArea.js';
import { BadgePertenceSL } from './BadgePertenceSL.js';
import { BadgePertenceLP } from './BadgePertenceLP.js';
import { NivelContemBadge } from './NivelContemBadge.js';
import { SllLeaderSl } from './SllLeaderSl.js';
import { Estado } from './Estado.js';
import { Pedido } from './Pedido.js';
import { Requisito } from './Requisito.js';
import { Motivo } from './Motivo.js';
import { Evidencia } from './Evidencia.js';
import { BadgeTrigger } from './BadgeTrigger.js';
import { SllGereP } from './SllGereP.js';
import { AdmGereP } from './AdmGereP.js';
import { TmGereP } from './TmGereP.js';
import { Log } from './Log.js';
import { FicheiroLog } from './FicheiroLog.js';
import { Notificacao } from './Notificacao.js';
import { Preferencia } from './Preferencia.js';
import { ConfigNotificacao } from './ConfigNotificacao.js';
import { RgpdTopico } from './RgpdTopico.js';
import { ConfigGeral } from './ConfigGeral.js';
import { ConfigNotificacaoUtilizador } from './ConfigNotificacaoUtilizador.js';
import { AGereN } from './AGereN.js';
import { AGereArea } from './AGereArea.js';
import { AGereServ } from './AGereServ.js';
import { AGereLp } from './AGereLp.js';
import { AGereB } from './AGereB.js';
import { AGereU } from './AGereU.js';
import { CObtemBadge } from './CObtemBadge.js';
import { Vitrine } from './Vitrine.js';
import { BadgeExpiracaoLog } from './BadgeExpiracaoLog.js';
import { BadgeImagem } from './BadgeImagem.js';
import { UtilizadorImagem } from './UtilizadorImagem.js';

// ============================================================
// Core domain: LearningPath -> ServiceLine -> Area -> Nivel
// ============================================================

LearningPath.hasMany(ServiceLine, { foreignKey: 'nlpath', as: 'serviceLines' });
ServiceLine.belongsTo(LearningPath, { foreignKey: 'nlpath', as: 'learningPath' });

ServiceLine.hasMany(Area, { foreignKey: 'nsline', as: 'areas' });
Area.belongsTo(ServiceLine, { foreignKey: 'nsline', as: 'serviceLine' });

Area.hasMany(Nivel, { foreignKey: 'narea', as: 'niveis' });
Nivel.belongsTo(Area, { foreignKey: 'narea', as: 'area' });

// ============================================================
// Badge domain: Tipo -> Badge -> Requisito, BadgeTrigger
// ============================================================

Tipo.hasMany(Badge, { foreignKey: 'ntipo', as: 'badges' });
Badge.belongsTo(Tipo, { foreignKey: 'ntipo', as: 'tipo' });

Badge.hasMany(Requisito, { foreignKey: 'nbadge', as: 'requisitos' });
Requisito.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });

Badge.hasMany(BadgeTrigger, { foreignKey: 'nbadge', as: 'triggers' });
BadgeTrigger.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });

// ============================================================
// Badge junction tables (N:M)
// ============================================================

Badge.belongsToMany(Area, { through: BadgePertenceArea, foreignKey: 'nbadge', otherKey: 'narea', as: 'areas' });
Area.belongsToMany(Badge, { through: BadgePertenceArea, foreignKey: 'narea', otherKey: 'nbadge', as: 'badges' });

Badge.belongsToMany(ServiceLine, { through: BadgePertenceSL, foreignKey: 'nbadge', otherKey: 'nsline', as: 'serviceLines' });
ServiceLine.belongsToMany(Badge, { through: BadgePertenceSL, foreignKey: 'nsline', otherKey: 'nbadge', as: 'badges' });

Badge.belongsToMany(LearningPath, { through: BadgePertenceLP, foreignKey: 'nbadge', otherKey: 'nlpath', as: 'learningPaths' });
LearningPath.belongsToMany(Badge, { through: BadgePertenceLP, foreignKey: 'nlpath', otherKey: 'nbadge', as: 'badges' });

Nivel.belongsToMany(Badge, { through: NivelContemBadge, foreignKey: 'nnivel', otherKey: 'nbadge', as: 'badges' });
Badge.belongsToMany(Nivel, { through: NivelContemBadge, foreignKey: 'nbadge', otherKey: 'nnivel', as: 'niveis' });

// ============================================================
// User-related junction tables
// ============================================================

Account.belongsToMany(ServiceLine, { through: SllLeaderSl, foreignKey: 'nutilizador', otherKey: 'nsline', as: 'ledServiceLines' });
ServiceLine.belongsToMany(Account, { through: SllLeaderSl, foreignKey: 'nsline', otherKey: 'nutilizador', as: 'leaders' });

Account.belongsToMany(Area, { through: Preferencia, foreignKey: 'nutilizador', otherKey: 'narea', as: 'preferredAreas' });
Area.belongsToMany(Account, { through: Preferencia, foreignKey: 'narea', otherKey: 'nutilizador', as: 'followers' });

// ============================================================
// Pedidos
// ============================================================

Pedido.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });
Badge.hasMany(Pedido, { foreignKey: 'nbadge', as: 'pedidos' });

Pedido.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(Pedido, { foreignKey: 'nutilizador', as: 'pedidos' });

Pedido.belongsTo(Estado, { foreignKey: 'estado', as: 'estadoInfo' });
Estado.hasMany(Pedido, { foreignKey: 'estado', as: 'pedidos' });

Pedido.hasMany(Evidencia, { foreignKey: 'npedido', as: 'evidencias' });
Evidencia.belongsTo(Pedido, { foreignKey: 'npedido', as: 'pedido' });

Evidencia.belongsTo(Requisito, { foreignKey: 'nreq', as: 'requisito' });
Requisito.hasMany(Evidencia, { foreignKey: 'nreq', as: 'evidencias' });

Motivo.belongsTo(Pedido, { foreignKey: 'npedido', as: 'pedido' });
Pedido.hasMany(Motivo, { foreignKey: 'npedido', as: 'motivos' });

Motivo.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(Motivo, { foreignKey: 'nutilizador', as: 'motivos' });

// ============================================================
// Pedido management junction tables
// ============================================================

SllGereP.belongsTo(Pedido, { foreignKey: 'npedido', as: 'pedido' });
Pedido.hasOne(SllGereP, { foreignKey: 'npedido', as: 'sllGere' });

AdmGereP.belongsTo(Pedido, { foreignKey: 'npedido', as: 'pedido' });
Pedido.hasOne(AdmGereP, { foreignKey: 'npedido', as: 'admGere' });

TmGereP.belongsTo(Pedido, { foreignKey: 'npedido', as: 'pedido' });
Pedido.hasOne(TmGereP, { foreignKey: 'npedido', as: 'tmGere' });

// ============================================================
// Logs and notifications
// ============================================================

Log.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(Log, { foreignKey: 'nutilizador', as: 'logs' });

FicheiroLog.belongsTo(Log, { foreignKey: 'nlog', as: 'log' });
Log.hasMany(FicheiroLog, { foreignKey: 'nlog', as: 'ficheiros' });

Notificacao.belongsTo(Log, { foreignKey: 'nlog', as: 'log' });
Log.hasMany(Notificacao, { foreignKey: 'nlog', as: 'notificacoes' });

Notificacao.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(Notificacao, { foreignKey: 'nutilizador', as: 'notificacoes' });

// ============================================================
// Reminders
// ============================================================

Reminder.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(Reminder, { foreignKey: 'nutilizador', as: 'lembretes' });

// ============================================================
// Badge acquisition
// ============================================================

CObtemBadge.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(CObtemBadge, { foreignKey: 'nutilizador', as: 'badgesObtidos' });

CObtemBadge.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });
Badge.hasMany(CObtemBadge, { foreignKey: 'nbadge', as: 'obtidosPor' });

CObtemBadge.belongsTo(Pedido, { foreignKey: 'npedido', as: 'pedido' });

// ============================================================
// Vitrine
// ============================================================

Vitrine.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(Vitrine, { foreignKey: 'nutilizador', as: 'vitrine' });

Vitrine.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });
Badge.hasMany(Vitrine, { foreignKey: 'nbadge', as: 'emVitrine' });

// ============================================================
// Badge expiration log
// ============================================================

BadgeExpiracaoLog.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });
Badge.hasMany(BadgeExpiracaoLog, { foreignKey: 'nbadge', as: 'logsExpiracao' });

// ============================================================
// Badge and user images
// ============================================================

BadgeImagem.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });
Badge.hasOne(BadgeImagem, { foreignKey: 'nbadge', as: 'dadosImagem' });

UtilizadorImagem.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasOne(UtilizadorImagem, { foreignKey: 'nutilizador', as: 'dadosImagem' });

// ============================================================
// Config notificacao utilizador
// ============================================================

ConfigNotificacaoUtilizador.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
Account.hasMany(ConfigNotificacaoUtilizador, { foreignKey: 'nutilizador', as: 'configNotificacoes' });

// ============================================================
// Admin management tables
// ============================================================

AGereN.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
AGereN.belongsTo(Nivel, { foreignKey: 'nnivel', as: 'nivel' });

AGereArea.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
AGereArea.belongsTo(Area, { foreignKey: 'narea', as: 'area' });

AGereServ.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
AGereServ.belongsTo(ServiceLine, { foreignKey: 'nsline', as: 'serviceLine' });

AGereLp.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
AGereLp.belongsTo(LearningPath, { foreignKey: 'nlpath', as: 'learningPath' });

AGereB.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
AGereB.belongsTo(Badge, { foreignKey: 'nbadge', as: 'badge' });

AGereU.belongsTo(Account, { foreignKey: 'nutilizador', as: 'utilizador' });
AGereU.belongsTo(Account, { foreignKey: 'adm_nutilizador', as: 'adminUtilizador' });
