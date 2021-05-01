/**
 * Simulate morale on units.
 *
 * @author Aziz Rahmad <azayrahmadDOTgmail.com>
 */
function Morale() {}

Morale.prototype.Schema =
	"<a:help>Deals with Morale.</a:help>" +
	"<a:example>" +
		"<Max>100</Max>" +
		"<RegenRate>1.0</RegenRate>" +
		"<IdleRegenRate>0</IdleRegenRate>" +
	"</a:example>" +
	"<element name='Max' a:help='Maximum Morale.'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>" +
	"<optional>" +
		"<element name='Initial' a:help='Initial Morale percentage. Default if unspecified is equal to Max.'>" +
			"<ref name='nonNegativeDecimal'/>" +
		"</element>" +
	"</optional>" +
	"<element name='RegenRate' a:help='Morale regeneration rate per second.'>" +
		"<data type='decimal'/>" +
	"</element>" +
	"<element name='IdleRegenRate' a:help='Morale regeneration rate per second when idle or garrisoned.'>" +
		"<data type='decimal'/>" +
	"</element>";

Morale.prototype.Init = function()
{
	this.affectedPlayers = [];
	this.affectedPlayersEnemies = [];
	// Cache this value so it allows techs to maintain previous morale level
	this.maxMorale = +this.template.Max;
	// Default to <Initial>, but use <Max> if it's undefined or zero
	this.Morale = +(this.template.Initial * this.GetMaxMorale() || this.GetMaxMorale());

	this.regenRate = ApplyValueModificationsToEntity("Morale/RegenRate", +this.template.RegenRate, this.entity);
	this.idleRegenRate = ApplyValueModificationsToEntity("Morale/IdleRegenRate", +this.template.IdleRegenRate, this.entity);
	this.regenRateCurrent = this.regenRate;

	//TODO: Make these customizable in template
	this.moraleRegenTime = 1000; 		// Morale regen time interval
	this.moraleDamageAttacked = 0.2;	// Morale damage on attacked
	this.moraleLevelHighThreshold = 4; 	// Morale level on which high morale effect is applied
	this.moraleLevelLowThreshold = 2; 	// Morale level on which low morale effect is applied

	this.penaltyRateWorker = 0.7; 		// Building and gathering speed rate penalty on low morale
	this.penaltyRateAttack = 1.3; 		// Attack repeat time penalty on low morale
	this.bonusRateWorker = 1.1; 		// Building and gathering speed rate bonus on high morale
	this.bonusRateAttack = 0.8; 		// Attack repeat time bonus on high morale

	//TODO: Make these customizable in template
	this.moraleRegenMultiplier = 0.1; 		// Morale influence regen multiplier
	this.moraleVisionRangeMultiplier = 0.3; 	// Range of morale influence, multiplied from entity's vision range
	this.moraleLevelEffectThreshold = 2; 	// Morale level on which Demoralized effect is applied

	this.CheckMoraleRegenTimer();
	this.CleanMoraleInfluence();
};

/**
 * Get current morale points.
 * @returns {number} Number of current Morale points for this entity.
 */
Morale.prototype.GetMorale = function()
{
	return this.Morale;
};

/**
 * Set current morale points.
 * @param {number} value Amount of Morale points.
 */
Morale.prototype.SetMorale = function(value)
{
	let old = this.Morale;
	this.Morale = Math.max(1, Math.min(this.GetMaxMorale(), value));
	this.RegisterMoraleChanged(old);
};

/**
 * Get current maximum morale points.
 * @returns {number} Number of current maximum Morale points for this entity.
 */
Morale.prototype.GetMaxMorale = function()
{
	return this.maxMorale;
};

/**
 * Get current morale level.
 *
 * Morale level is a percentage of the morale points, from 1 to 5.
 *
 * @returns {number} Number of current Morale level.
 */
Morale.prototype.GetMoraleLevel = function()
{
	return this.Morale === 0 ? 1 : Math.ceil(5 * this.Morale / this.maxMorale);
};

/**
 * Check if current morale level has changed.
 *
 * @param {number} from Previous Morale level.
 * @returns {boolean} Returns true if there is morale level change.
 */
Morale.prototype.IsMoraleLevelChanged = function(from)
{
	return from != this.GetMoraleLevel();
};

/**
 * Get base regen rate.
 *
 * Regen rate is the amount added/removed from current morale points.
 *
 * @returns {number} Number of Morale regen rate for this entity as set in template.
 */
Morale.prototype.GetRegenRate = function()
{
	return this.regenRate;
};

/**
 * Get base idle regen rate.
 *
 * Idle regen rate is the additional regen rate if the entity is idle.
 *
 * @returns {number} Number of Morale idle regen rate for this entity as set in template.
 */
Morale.prototype.GetIdleRegenRate = function()
{
	return this.idleRegenRate;
};

/**
 * Get current regen rate.
 *
 * Current regen rate is calculated considering if entity is idle or not.
 *
 * @returns {number} Number of current Morale regen rate for this entity.
 */
Morale.prototype.GetCurrentRegenRate = function()
{
	let regen = this.GetRegenRate();
	if (this.GetIdleRegenRate() != 0)
	{
		let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
		if (cmpUnitAI && (cmpUnitAI.IsIdle() || cmpUnitAI.IsGarrisoned() && !cmpUnitAI.IsTurret()))
			regen += this.GetIdleRegenRate();
	}
	return regen;
};

/**
 * Get the vision range where morale influence of visible nearby entities is received.
 *
 * The morale vision range is closer than actual entity's vision range. Configurable
 * via this.moraleVisionRangeMultiplier
 *
 * @returns {number} Morale vision range.
 */
Morale.prototype.GetVisionRange = function()
{
	let cmpVision = Engine.QueryInterface(this.entity, IID_Vision);
	if (!cmpVision)
		return false;
	return cmpVision.GetRange() * this.moraleVisionRangeMultiplier;
};

/**
 * Calculate Morale Influence (alliance, level, and significance).
 *
 * @param {Object} ent - The entity with influence.
 * @param {boolean} ally - Whether the entity is allied to this entity.
 * @returns {number} Morale influence value.
 */
Morale.prototype.CalculateMoraleInfluence = function(ent, ally)
{
	let cmpMoraleInfluence = Engine.QueryInterface(ent, IID_MoraleInfluence);
	if (cmpMoraleInfluence)
	{
		let alliance = ally ? 1 : -1;
		let moraleSignificance = cmpMoraleInfluence.GetSignificance();
		let moralePercentage = 1;
		let moraleInfluenceBonus = 1;

		let cmpIdentity = Engine.QueryInterface(this.entity, IID_Identity);
		if (cmpIdentity && cmpMoraleInfluence.template.InfluenceBonus)
		{
			if (!ally && cmpMoraleInfluence.template.InfluenceBonus.Enemy)
			{
				for (let affectedClass in cmpMoraleInfluence.template.InfluenceBonus.Enemy)
				{
					let bonus = +cmpMoraleInfluence.template.InfluenceBonus.Enemy[affectedClass];
					if (cmpIdentity.HasClass(affectedClass))
						moraleInfluenceBonus += bonus;
				}
			}
			else if (ally && cmpMoraleInfluence.template.InfluenceBonus.Ally)
			{
				for (let affectedClass in cmpMoraleInfluence.template.InfluenceBonus.Ally)
				{
					let bonus = +cmpMoraleInfluence.template.InfluenceBonus.Ally[affectedClass];
					if (cmpIdentity.HasClass(affectedClass))
						moraleInfluenceBonus += bonus;
				}
			}
		}

		var cmpMorale = Engine.QueryInterface(ent, IID_Morale);
		if (cmpMorale)
			moralePercentage = cmpMorale.GetMoraleLevel() / 5;

		return alliance * moralePercentage * moraleSignificance * moraleInfluenceBonus;
	}
	else
		return 0;
};

/**
 * Receiving morale influence from all entities in range.
 *
 * @param {Object} ents - Collection of entity with influence in range.
 * @param {boolean} ally - Whether the entity is allied to this entity.
 */
Morale.prototype.ReceiveMoraleInfluence = function(ents, ally)
{
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	for (let ent of ents)
	{
		let moraleInfluence = this.CalculateMoraleInfluence(ent, ally) * this.moraleRegenMultiplier;
		if (moraleInfluence)
		{
			cmpModifiersManager.AddModifiers(
				(ally ? "MoraleAllies" : "MoraleEnemies") + ent,
				{
					"Morale/RegenRate": [{ "affects": ["Unit","Structure"], "add": moraleInfluence}]
				},
				this.entity,
				true
			);
		}
	}

	if(!ally)
	{
        if (this.GetMoraleLevel() === 1)
		{
            var cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
    		if (cmpUnitAI)
		 	{
				if(ents.length && !cmpUnitAI.IsFleeing())
					cmpUnitAI.PushOrderFront("Flee", { "target": ents[0], "force": true });
				// else if (ents.length === 0 && cmpUnitAI.IsFleeing())
				// 	cmpUnitAI.StopMoving();
			}
        }
	}

	if(ally)
	{
        if (this.GetMoraleLevel() === 1)
		{
            var cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
    		if (cmpUnitAI)
		 	{
				if(ents.length && cmpUnitAI.IsFleeing())
				{
					cmpUnitAI.StopMoving();
					cmpUnitAI.MoveToTarget(ents[0]);
				}
			}
        }
	}
};

/**
 * Removing applied morale influence when entities leave the range.
 *
 * @param {Object} ents - Collection of entity with influence leaving the range.
 * @param {boolean} ally - Whether the entity is allied to this entity.
 */
Morale.prototype.RemoveMoraleInfluence = function(ents, ally)
{
	if (!ents.length)
		return;
	for (let ent of ents)
	{
		var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
		cmpModifiersManager.RemoveAllModifiers((ally ? "MoraleAllies" : "MoraleEnemies") + ent, this.entity);
	}
};

/**
 * Remove all influence and refresh entities in range.
 */
Morale.prototype.CleanMoraleInfluence = function()
{
	var cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);

	if(this.affectedPlayers)
		this.RemoveMoraleInfluence(this.affectedPlayers, true);
	if(this.affectedPlayersEnemies)
		this.RemoveMoraleInfluence(this.affectedPlayersEnemies, false);

	if (this.rangeQuery)
		cmpRangeManager.DestroyActiveQuery(this.rangeQuery);
	if (this.rangeQueryEnemy)
		cmpRangeManager.DestroyActiveQuery(this.rangeQueryEnemy);

	this.rangeQuery = undefined;
	this.rangeQueryEnemy = undefined;

	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (!cmpPlayer)
		cmpPlayer = QueryOwnerInterface(this.entity);

	if (!cmpPlayer || cmpPlayer.GetState() == "defeated")
		return;

	let visionRange = this.GetVisionRange()
	this.affectedPlayers = cmpPlayer.GetAllies();
	this.rangeQuery = cmpRangeManager.CreateActiveQuery(
		this.entity,
		0,
		visionRange,
		this.affectedPlayers,
		IID_Identity,
		cmpRangeManager.GetEntityFlagMask("normal"),
		false
	);
	cmpRangeManager.EnableActiveQuery(this.rangeQuery);

	this.affectedPlayersEnemies = cmpPlayer.GetEnemies();
	this.rangeQueryEnemy = cmpRangeManager.CreateActiveQuery(
		this.entity,
		0,
		visionRange,
		this.affectedPlayersEnemies,
		IID_Identity,
		cmpRangeManager.GetEntityFlagMask("normal"),
		false
	);
	cmpRangeManager.EnableActiveQuery(this.rangeQueryEnemy);
};

/**
 * Execute morale regeneration based on current regen rate.
 */
Morale.prototype.ExecuteRegeneration = function()
{
	let regen = this.GetCurrentRegenRate();

	if (regen > 0)
		this.IncreaseMorale(regen);
	else
		this.ReduceMorale(-regen);
};

/*
 * Check if the regeneration timer needs to be started or stopped
 */
Morale.prototype.CheckMoraleRegenTimer = function()
{
	// check if we need a timer
	if (this.GetRegenRate() == 0 && this.GetIdleRegenRate() == 0 ||
	    this.Morale == this.GetMaxMorale() && this.GetRegenRate() >= 0 && this.GetIdleRegenRate() >= 0)
	{
		// we don't need a timer, disable if one exists
		if (this.regenTimer)
		{
			let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
			cmpTimer.CancelTimer(this.regenTimer);
			this.regenTimer = undefined;
		}
		return;
	}

	// we need a timer, enable if one doesn't exist
	if (this.regenTimer)
		return;

	let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
	this.regenTimer = cmpTimer.SetInterval(this.entity, IID_Morale, "ExecuteRegeneration", this.moraleRegenTime, this.moraleRegenTime, null);
};

/**
 * @param {number} amount - The amount of Morale to substract. Stop reduction once reached 0.
 * @return {{ MoraleChange:number }} -  Number of Morale points lost.
 */
Morale.prototype.ReduceMorale = function(amount)
{
	if (!amount || !this.Morale)
		return { "MoraleChange": 0 };

	let oldMorale = this.Morale;
	let oldMoraleLevel = this.GetMoraleLevel();
	// If we reached 0, then stop reducing.
	if (amount >= this.Morale)
	{
		this.Morale = 0;
		this.RegisterMoraleChanged(oldMorale);
		return { "MoraleChange": -oldMorale };
	}

	this.Morale -= amount;
	this.RegisterMoraleChanged(oldMorale);
	//if (this.IsMoraleLevelChanged(oldMoraleLevel))
		this.ApplyMoraleEffects();
	return { "MoraleChange": this.Morale - oldMorale };
};

/**
 * @param {number} amount - The amount of Morale to add. Stop increase once reached maxMorale.
 * @return {{ old:number, new:number }} -  Number of Morale points gained.
 */
Morale.prototype.IncreaseMorale = function(amount)
{
	let old = this.Morale;
	let oldMoraleLevel = this.GetMoraleLevel();

	this.Morale = Math.min(this.Morale + amount, this.GetMaxMorale());

	this.RegisterMoraleChanged(old);
	//if (this.IsMoraleLevelChanged(oldMoraleLevel))
		this.ApplyMoraleEffects();
	return { "old": old, "new": this.Morale };
};

/*
 * Recalculate morale points based on current maximum morale and regen rate.
 */
Morale.prototype.RecalculateMoraleValues = function()
{
	let oldMaxMorale = this.GetMaxMorale();
	let newMaxMorale = ApplyValueModificationsToEntity("Morale/Max", +this.template.Max, this.entity);
	if (oldMaxMorale != newMaxMorale)
	{
		let newMorale = this.Morale * newMaxMorale/oldMaxMorale;
		this.maxMorale = newMaxMorale;
		this.SetMorale(newMorale);
	}

	let oldRegenRate = this.regenRate;
	this.regenRate = ApplyValueModificationsToEntity("Morale/RegenRate", +this.template.RegenRate, this.entity);

	let oldIdleRegenRate = this.idleRegenRate;
	this.idleRegenRate = ApplyValueModificationsToEntity("Morale/IdleRegenRate", +this.template.IdleRegenRate, this.entity);

	if (this.regenRate != oldRegenRate || this.idleRegenRate != oldIdleRegenRate)
		this.CheckMoraleRegenTimer();
};

/*
 * Apply morale effect to entity based on its morale level.
 */
Morale.prototype.ApplyMoraleEffects = function()
{
	var highMoraleModifierName = "HighMorale";
	var lowMoraleModifierName = "Demoralized";

	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	var moraleLevel = this.GetMoraleLevel();

	cmpModifiersManager.RemoveAllModifiers(highMoraleModifierName, this.entity);
	cmpModifiersManager.RemoveAllModifiers(lowMoraleModifierName, this.entity);

	if (moraleLevel >= 4)
	{
		// High morale effects
		cmpModifiersManager.AddModifiers(
				highMoraleModifierName,
				{
					"Attack/Melee/RepeatTime": [{ "affects": ["Unit"], "multiply": this.bonusRateAttack }],
					"Attack/Ranged/RepeatTime": [{ "affects": ["Unit","Structure"], "multiply": this.bonusRateAttack }],
					"Builder/Rate": [{ "affects": ["Unit"], "multiply": this.bonusRateWorker }],
					"ResourceGatherer/BaseSpeed": [{ "affects": ["Unit"], "multiply": this.bonusRateWorker }],
					"ProductionQueue/BatchTimeModifier": [{ "affects": ["Structure"], "multiply": this.bonusRateAttack }],
					"ProductionQueue/TechCostMultiplier/time": [{ "affects": ["Structure"], "multiply": this.bonusRateAttack }]
				},
				this.entity
		);
	}
	else if (moraleLevel <= 2)
	{
		// Low morale effects
		cmpModifiersManager.AddModifiers(
			lowMoraleModifierName,
			{
				"Attack/Melee/RepeatTime": [{ "affects": ["Unit"], "multiply": this.penaltyRateAttack }],
				"Attack/Ranged/RepeatTime": [{ "affects": ["Unit","Structure"], "multiply": this.penaltyRateAttack }],
				"Builder/Rate": [{ "affects": ["Unit"], "multiply": this.penaltyRateWorker }],
				"ResourceGatherer/BaseSpeed": [{ "affects": ["Unit"], "multiply": this.penaltyRateWorker }],
				"ProductionQueue/BatchTimeModifier": [{ "affects": ["Structure"], "multiply": this.penaltyRateAttack }],
				"ProductionQueue/TechCostMultiplier/time": [{ "affects": ["Structure"], "multiply": this.penaltyRateAttack }]
			},
			this.entity
		);
	}

	this.ChangeStance(this.entity, moraleLevel);

	// let cmpIdentity = Engine.QueryInterface(this.entity, IID_Identity);
	// if (cmpIdentity)
	// {
	// 	cmpIdentity.SetControllable(!(moraleLevel === 1));
	// }
};

/**
 * Change entity stance based on morale level.
 *
 * @param {Object} entity - The entity with stance.
 * @param {number} moraleLevel - Current morale level of the entity.
 */
Morale.prototype.ChangeStance = function(entity, moraleLevel)
{
	var cmpUnitAI = Engine.QueryInterface(entity, IID_UnitAI);
	if (cmpUnitAI)
	{
		if (moraleLevel === 1)
		{
			cmpUnitAI.SetStance("passive");
		}
		else if (moraleLevel === 5)
		{
			//cmpUnitAI.SetStance("violent");
			cmpUnitAI.Cheer();
		}
		else
		{
			cmpUnitAI.SetStance(cmpUnitAI.template.DefaultStance);
			if(cmpUnitAI.order && cmpUnitAI.order.type === "Flee")
			{
				cmpUnitAI.StopMoving();
			}
		}
	}
};

/**
 * Calculate morale bonus when inflicting attack to another entity.
 *
 * @param {Object} target - The entity being attacked.
 * @param {Object} attacker - The entity inflicting attack.
 */
Morale.prototype.CalculateMoraleAttackBonus = function(attacker)
{
	let sideFlankBonus = 1;
	let backFlankBonus = 2;
	let backAngleToleration = 1.0;
	let sideAngleToleration = 2.0;
	let flankBonus = 0;

	let cmpTargetPosition = Engine.QueryInterface(this.entity, IID_Position);
	let cmpAttackerPosition = Engine.QueryInterface(attacker, IID_Position);

	if (!cmpAttackerPosition || !cmpAttackerPosition.IsInWorld())
		return;
	if (!cmpTargetPosition || !cmpTargetPosition.IsInWorld())
		return;

	let attackerRotation = cmpAttackerPosition.GetRotation().y;
	let targetRotation = cmpTargetPosition.GetRotation().y;

	let angleDiff = Math.abs((attackerRotation - targetRotation) % (2 * Math.PI));

	if (angleDiff < backAngleToleration)
	{
		flankBonus = backFlankBonus;
	}
	else if (angleDiff < sideAngleToleration)
	{
		flankBonus = sideFlankBonus;
	}
	this.ReduceMorale(flankBonus);
};

Morale.prototype.OnValueModification = function(msg)
{
	if (msg.component == "Morale")
		this.RecalculateMoraleValues();
};

Morale.prototype.OnOwnershipChanged = function(msg)
{
	if (msg.to != INVALID_PLAYER)
		this.RecalculateMoraleValues();
};

Morale.prototype.OnAttacked = function(msg)
{
	if (msg.fromStatusEffect)
		return;

	if (msg.attacker && this.GetMoraleLevel() === 1)
	{
		let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
		if (cmpUnitAI && !cmpUnitAI.IsFleeing())
		{
			cmpUnitAI.PushOrderFront("Flee", { "target": msg.attacker, "force": true });
		}
	}
};

Morale.prototype.OnHealthChanged = function(msg)
{
	let cmpHealth = QueryMiragedInterface(this.entity, IID_Health);
	if (cmpHealth)
	{
		let maxHp = cmpHealth.GetMaxHitpoints();
		let currentHp = msg.to;
		let diff = this.GetMaxMorale() * (msg.to - msg.from) / maxHp;
		if (diff > 0)
			this.IncreaseMorale(diff);
		else
			this.ReduceMorale(-diff);

		let cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
		let threshold =  cmpHealth.GetMaxHitpoints() / 3;
		if (currentHp <= threshold)
		{
			cmpModifiersManager.AddModifiers("BadlyWoundedMorale", {"Morale/RegenRate": [{ "affects": ["Unit"], "add": -1 }]}, this.entity);
		}
		else
		{
			cmpModifiersManager.RemoveAllModifiers("BadlyWoundedMorale", this.entity);
		}
	}
};

Morale.prototype.OnRangeUpdate = function(msg)
{
	if (msg.tag == this.rangeQuery)
	{
		this.ReceiveMoraleInfluence(msg.added, true);
		this.RemoveMoraleInfluence(msg.removed, true);
	}
	if (msg.tag == this.rangeQueryEnemy)
	{
		this.ReceiveMoraleInfluence(msg.added, false);
		this.RemoveMoraleInfluence(msg.removed, false);
	}
};

Morale.prototype.OnGarrisonedUnitsChanged = function(msg)
{
	this.ReceiveMoraleInfluence(msg.added, true);
	this.RemoveMoraleInfluence(msg.removed, true);
};

Morale.prototype.OnOwnershipChanged = function(msg)
{
	this.CleanMoraleInfluence();
};

Morale.prototype.OnDiplomacyChanged = function(msg)
{
	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (cmpPlayer && (cmpPlayer.GetPlayerID() == msg.player || cmpPlayer.GetPlayerID() == msg.otherPlayer) ||
	   IsOwnedByPlayer(msg.player, this.entity) ||
	   IsOwnedByPlayer(msg.otherPlayer, this.entity))
		this.CleanMoraleInfluence();
};

Morale.prototype.OnDestroy = function()
{
	this.CleanMoraleInfluence();
};

Morale.prototype.OnGlobalPlayerDefeated = function(msg)
{
	let cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (cmpPlayer && cmpPlayer.GetPlayerID() == msg.playerId)
		this.CleanMoraleInfluence();
};

Morale.prototype.RegisterMoraleChanged = function(from)
{
	this.CheckMoraleRegenTimer();
	Engine.PostMessage(this.entity, MT_MoraleChanged, { "from": from, "to": this.Morale });
};

Engine.RegisterComponentType(IID_Morale, "Morale", Morale);
