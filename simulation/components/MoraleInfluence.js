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
	"</optional>" +
	"<optional>" +
		"<element name='InfluenceBonus'>" +
			"<oneOrMore>" +
				"<element a:help='Alliance.'>" +
					"<anyName/>" +
					"<element a:help='Name of the class that will receive the bonus'>" +
						"<anyName/>" +
						"<data type='decimal'/>" +
					"</element>" +
				"</element>" +
			"</oneOrMore>" +
		"</element>" +
	"</optional>";

MoraleInfluence.prototype.Init = function()
{
	this.significance = +(this.template.Significance || 1);
	//TODO: Make these customizable in template
	this.moraleDeathDamageMultiplier = 10; // Morale damage on death multiplier
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
 * Instant morale increase/damage to nearby units.
 *
 * @param {string} event - Event that triggers the influence (currently unused).
 */
MoraleInfluence.prototype.CauseMoraleInstantInfluence = function(event)
{
	let damageMultiplier = 1;
	let moraleRange = this.GetSignificance() * 10;

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


	for (let ent of nearEntsAllies)
	{
		let distance = cmpObstructionManager.DistanceToPoint(ent, pos.x, pos.y);

		damageMultiplier = Math.max(0, 1 - distance * distance / (moraleRange * moraleRange));

		let cmpNearEntMorale = Engine.QueryInterface(ent, IID_Morale);
		if (cmpNearEntMorale)
		{
			let moraleDamage = cmpNearEntMorale.CalculateMoraleInfluence(this.entity, true);
			cmpNearEntMorale.ReduceMorale(damageMultiplier * moraleDamage * this.moraleDeathDamageMultiplier);
		}
	}

	for (let ent of nearEntsEnemies)
	{
		let distance = cmpObstructionManager.DistanceToPoint(ent, pos.x, pos.y);

		damageMultiplier = Math.max(0, 1 - distance * distance / (moraleRange * moraleRange));

		let cmpNearEntMorale = Engine.QueryInterface(ent, IID_Morale);
		if (cmpNearEntMorale)
		{
			let moraleDamage = cmpNearEntMorale.CalculateMoraleInfluence(this.entity, true);
			cmpNearEntMorale.IncreaseMorale(damageMultiplier * moraleDamage * this.moraleDeathDamageMultiplier);
		}
	}
};

Engine.RegisterComponentType(IID_MoraleInfluence, "MoraleInfluence", MoraleInfluence);
