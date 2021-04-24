/**
 * Simulate morale influence to nearby units.
 *
 * @author Aziz Rahmad <azayrahmadDOTgmail.com>
 */
function MoraleInfluence() {}

MoraleInfluence.prototype.Schema =
	"<a:help>Deals with Morale Influence.</a:help>" +
	"<a:example>" +
		"<Range>10</Range>" +
	"</a:example>" +
	"<optional>" +
		"<element name='Significance' a:help='The rate of unit morale influence to other units in range. Default to 1.'>" +
			"<ref name='nonNegativeDecimal'/>" +
		"</element>" +
	"</optional>" +
	"<optional>" +
		"<element name='Range' a:help='Range of morale influence.'>" +
			"<data type='decimal'/>" +
		"</element>" +
	"</optional>";

MoraleInfluence.prototype.Init = function()
{
	this.affectedPlayers = [];
	this.affectedPlayersEnemies = [];

	this.significance = +(this.template.Significance || 1);

	//TODO: Make these customizable in template
	this.moraleRegenMultiplier = 0.1; 		// Morale influence regen multiplier
	this.moraleDeathDamageMultiplier = 0.4; // Morale damage on death multiplier

	this.moraleVisionRangeMultiplier = 0.3 	// Range of morale influence, multiplied from entity's vision range
	this.moraleLevelEffectThreshold = 2; 	// Morale level on which Demoralized effect is applied

	this.CleanMoraleInfluence();
};

/**
 * Get morale significance of the entity.
 *
 * The higher the entity's significance, the greater morale influence it has
 * to nearby entities.
 *
 * @returns {number} Number of Morale idle regen rate for this entity as set in template.
 */
MoraleInfluence.prototype.GetSignificance = function()
{
	return this.significance;
};

/**
 * Get the vision range where morale influence of visible nearby entities is received.
 *
 * The morale vision range is closer than actual entity's vision range. Configurable
 * via this.moraleVisionRangeMultiplier
 *
 * @returns {number} Morale vision range.
 */
MoraleInfluence.prototype.GetVisionRange = function()
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
MoraleInfluence.prototype.CalculateMoraleInfluence = function(ent, ally)
{
	let alliance = ally ? 1 : -1;
	let moraleSignificance = this.GetSignificance();
	let moralePercentage = 1;

	var cmpMorale = Engine.QueryInterface(ent, IID_Morale);
	if (cmpMorale)
		moralePercentage = cmpMorale.GetMoraleLevel() / 5;

	return alliance * moralePercentage * moraleSignificance;
};

/**
 * Applying morale influence by updating regenRate of all entities in range.
 *
 * @param {Object} ents - Collection of entity with influence in range.
 * @param {boolean} ally - Whether the entity is allied to this entity.
 */
MoraleInfluence.prototype.ApplyMoraleInfluence = function(ents, ally)
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
        var cmpMorale = Engine.QueryInterface(this.entity, IID_Morale);
        if (cmpMorale && cmpMorale.GetMoraleLevel() === 1)
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
};

/**
 * Removing applied morale influence when entities leaving the range.
 *
 * @param {Object} ents - Collection of entity with influence leaving the range.
 * @param {boolean} ally - Whether the entity is allied to this entity.
 */
MoraleInfluence.prototype.RemoveMoraleInfluence = function(ents, ally)
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
MoraleInfluence.prototype.CleanMoraleInfluence = function()
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
 * Instant morale increase/damage to nearby units.
 *
 * @param {string} event - Event that triggers the influence (currently unused).
 */
MoraleInfluence.prototype.CauseMoraleInstantInfluence = function(event)
{
	let damageMultiplier = 1;
	let moraleRange = this.GetVisionRange();

	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!cmpPosition || !cmpPosition.IsInWorld())
		return;
	let pos = cmpPosition.GetPosition2D();

	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	let owner = cmpOwnership.GetOwner();
	if (owner == INVALID_PLAYER)
		warn("Unit causing morale death damage does not have any owner.");

	let nearEntsAllies = PositionHelper.EntitiesNearPoint(pos, moraleRange,
		QueryPlayerIDInterface(owner).GetAllies());
	let nearEntsEnemies = PositionHelper.EntitiesNearPoint(pos, moraleRange,
		QueryPlayerIDInterface(owner).GetEnemies());

	let cmpObstructionManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ObstructionManager);
    let cmpMorale = Engine.QueryInterface(this.entity, IID_Morale);
    if (cmpMorale)
	{
        var moraleDamage = this.CalculateMoraleInfluence(this.entity, true) * cmpMorale.GetMaxMorale();
    	for (let ent of nearEntsAllies)
    	{
    		let distance = cmpObstructionManager.DistanceToPoint(ent, pos.x, pos.y);

    		damageMultiplier = Math.max(0, 1 - distance * distance / (moraleRange * moraleRange));

    		let cmpMorale = Engine.QueryInterface(ent, IID_Morale);
    		if (cmpMorale)
    			cmpMorale.ReduceMorale(damageMultiplier * moraleDamage * this.moraleDeathDamageMultiplier);
    	}

    	for (let ent of nearEntsEnemies)
    	{
    		let distance = cmpObstructionManager.DistanceToPoint(ent, pos.x, pos.y);

    		damageMultiplier = Math.max(0, 1 - distance * distance / (moraleRange * moraleRange));

    		let cmpMorale = Engine.QueryInterface(ent, IID_Morale);
    		if (cmpMorale)
    			cmpMorale.IncreaseMorale(damageMultiplier * moraleDamage * this.moraleDeathDamageMultiplier);
    	}
    }
};


MoraleInfluence.prototype.OnRangeUpdate = function(msg)
{
	if (msg.tag == this.rangeQuery)
	{
		this.ApplyMoraleInfluence(msg.added, true);
		this.RemoveMoraleInfluence(msg.removed, true);
	}
	if (msg.tag == this.rangeQueryEnemy)
	{
		this.ApplyMoraleInfluence(msg.added, false);
		this.RemoveMoraleInfluence(msg.removed, false);
	}
};

MoraleInfluence.prototype.OnGarrisonedUnitsChanged = function(msg)
{
	this.ApplyMoraleInfluence(msg.added, true);
	this.RemoveMoraleInfluence(msg.removed, true);
};

MoraleInfluence.prototype.OnOwnershipChanged = function(msg)
{
	this.CleanMoraleInfluence();
};

MoraleInfluence.prototype.OnDiplomacyChanged = function(msg)
{
	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (cmpPlayer && (cmpPlayer.GetPlayerID() == msg.player || cmpPlayer.GetPlayerID() == msg.otherPlayer) ||
	   IsOwnedByPlayer(msg.player, this.entity) ||
	   IsOwnedByPlayer(msg.otherPlayer, this.entity))
		this.CleanMoraleInfluence();
};

MoraleInfluence.prototype.OnDestroy = function()
{
	this.CleanMoraleInfluence();
};

MoraleInfluence.prototype.OnGlobalPlayerDefeated = function(msg)
{
	let cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (cmpPlayer && cmpPlayer.GetPlayerID() == msg.playerId)
		this.CleanMoraleInfluence();
};

Engine.RegisterComponentType(IID_MoraleInfluence, "MoraleInfluence", MoraleInfluence);
