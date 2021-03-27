/**
 * @param {number} amount - The amount of hitpoints to substract. Kills the entity if required.
 * @return {{ healthChange:number }} -  Number of health points lost.
 */
Health.prototype.Reduce = function(amount)
{
	// If we are dead, do not do anything
	// (The entity will exist a little while after calling DestroyEntity so this
	// might get called multiple times)
	// Likewise if the amount is 0.
	if (!amount || !this.hitpoints)
		return { "healthChange": 0 };

	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	let oldHitpoints = this.hitpoints;
	// If we reached 0, then die.
	if (amount >= this.hitpoints)
	{
		this.hitpoints = 0;
		this.RegisterHealthChanged(oldHitpoints);
		this.HandleDeath();
		return { "healthChange": -oldHitpoints };
	}

	// If we are not marked as injured, do it now
	if (!this.IsInjured())
	{
		let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
		if (cmpRangeManager)
			cmpRangeManager.SetEntityFlag(this.entity, "injured", true);
	}

	this.hitpoints -= amount;
	this.RegisterHealthChanged(oldHitpoints);

	// Morale modifiers, units below 1/2 of their max hp receive penalties
	let cmpHealth = QueryMiragedInterface(this.entity, IID_Health);
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	let currentHp = cmpHealth.GetHitpoints();
	let maxHp = cmpHealth.GetMaxHitpoints()
	let threshold =  maxHp / 2; 
	if (currentHp <= threshold ) 
		cmpModifiersManager.AddModifiers("BadlyWoundedMorale", {"Morale/RegenRate": [{ "affects": ["Unit"], "add": -1 }]}, this.entity);

	return { "healthChange": this.hitpoints - oldHitpoints };
};

/**
 * Handle what happens when the entity dies.
 */
Health.prototype.HandleDeath = function()
{
	let cmpDeathDamage = Engine.QueryInterface(this.entity, IID_DeathDamage);
	if (cmpDeathDamage)
		cmpDeathDamage.CauseDeathDamage();
	let cmpMorale = Engine.QueryInterface(this.entity, IID_Morale);
	if (cmpMorale)
		cmpMorale.CauseMoraleDeathDamage()
	
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

Health.prototype.Increase = function(amount)
{
	// Before changing the value, activate Fogging if necessary to hide changes
	let cmpFogging = Engine.QueryInterface(this.entity, IID_Fogging);
	if (cmpFogging)
		cmpFogging.Activate();

	if (!this.IsInjured())
		return { "old": this.hitpoints, "new": this.hitpoints };

	// If we're already dead, don't allow resurrection
	if (this.hitpoints == 0)
		return undefined;

	let old = this.hitpoints;
	this.hitpoints = Math.min(this.hitpoints + amount, this.GetMaxHitpoints());

	if (!this.IsInjured())
	{
		let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
		if (cmpRangeManager)
			cmpRangeManager.SetEntityFlag(this.entity, "injured", false);
	}

	this.RegisterHealthChanged(old);

	// Morale modifiers, units above 1/2 of their max hp will get their penalties removed
	let cmpHealth = QueryMiragedInterface(this.entity, IID_Health);		
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);

	let currentHp = cmpHealth.GetHitpoints();
	let maxHp = cmpHealth.GetMaxHitpoints()
	let threshold =  maxHp / 2;
	if( currentHp > threshold )
		cmpModifiersManager.RemoveAllModifiers("BadlyWoundedMorale", this.entity);
	
	return { "old": old, "new": this.hitpoints };

};

Engine.ReRegisterComponentType(IID_Health, "Health", Health);
