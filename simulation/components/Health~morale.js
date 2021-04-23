/**
 * Handle what happens when the entity dies.
 */
Health.prototype.HandleDeath = function()
{
	let cmpDeathDamage = Engine.QueryInterface(this.entity, IID_DeathDamage);
	if (cmpDeathDamage)
		cmpDeathDamage.CauseDeathDamage();
	let cmpMoraleInfluence = Engine.QueryInterface(this.entity, IID_MoraleInfluence);
	if (cmpMoraleInfluence)
		cmpMoraleInfluence.CauseMoraleInstantInfluence("death");

	PlaySound("death", this.entity);

	if (this.template.SpawnEntityOnDeath)
		this.CreateDeathSpawnedEntity();

	switch (this.template.DeathType)
	{
	case "corpse":
		this.CreateCorpse();
		break;

	case "remain":
		return;

	case "vanish":
		break;

	default:
		error("Invalid template.DeathType: " + this.template.DeathType);
		break;
	}

	Engine.DestroyEntity(this.entity);
};

Engine.ReRegisterComponentType(IID_Health, "Health", Health);
