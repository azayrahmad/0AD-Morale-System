function Morale() {}

Morale.prototype.Schema =
	"<a:help>Deals with Morale.</a:help>" +
	"<a:example>" +
		"<Max>100</Max>" +
		"<RegenRate>1.0</RegenRate>" +
		"<IdleRegenRate>0</IdleRegenRate>" +
		"<Radius>10</Radius>" +
	"</a:example>" +
	"<element name='Max' a:help='Maximum Morale'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>" +
	"<optional>" +
		"<element name='Initial' a:help='Initial Morale. Default if unspecified is equal to Max'>" +
			"<ref name='nonNegativeDecimal'/>" +
		"</element>" +
	"</optional>" +
	"<element name='RegenRate' a:help='Hitpoint regeneration rate per second.'>" +
		"<data type='decimal'/>" +
	"</element>" +
	"<element name='IdleRegenRate' a:help='Hitpoint regeneration rate per second when idle or garrisoned.'>" +
		"<data type='decimal'/>" +
	"</element>" +
	"<element name='Radius' a:help='Range of morale influence.'>" +
		"<data type='decimal'/>" +
	"</element>";

Morale.prototype.Init = function()
{
	this.affectedPlayers = [];

	// Cache this value so it allows techs to maintain previous Morale level
	this.maxMorale = +this.template.Max;
	// Default to <Initial>, but use <Max> if it's undefined or zero
	this.Morale = +(this.template.Initial || this.GetMaxMorale());
	this.regenRate = ApplyValueModificationsToEntity("Morale/RegenRate", +this.template.RegenRate, this.entity);
	this.idleRegenRate = ApplyValueModificationsToEntity("Morale/IdleRegenRate", +this.template.IdleRegenRate, this.entity);
	
	this.CleanMoraleInfluence();
	this.CheckRegenTimer();
};

/**
 * Returns the current Morale value.
 */
Morale.prototype.GetMorale = function()
{
	return this.Morale;
};

/**
 * Returns the current Morale level.
 */
Morale.prototype.GetMoraleLevel = function()
{
	if (this.Morale > 80)
		return 5;
	else if (this.Morale > 60)
		return 4;
	else if (this.Morale > 40)
		return 3;
	else if (this.Morale > 20)
		return 2;
	else
		return 1;
};

Morale.prototype.GetMaxMorale = function()
{
	return this.maxMorale;
};

Morale.prototype.SetMorale = function(value)
{
	let old = this.Morale;
	this.Morale = Math.max(1, Math.min(this.GetMaxMorale(), value));
	this.RegisterMoraleChanged(old);
};

Morale.prototype.GetIdleRegenRate = function()
{
	return this.idleRegenRate;
};

Morale.prototype.GetRegenRate = function()
{
	return this.regenRate;
};

Morale.prototype.ExecuteRegeneration = function()
{
	let regen = this.GetRegenRate();
	if (this.GetIdleRegenRate() != 0)
	{
		let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
		if (cmpUnitAI && (cmpUnitAI.IsIdle() || cmpUnitAI.IsGarrisoned() && !cmpUnitAI.IsTurret()))
			regen += this.GetIdleRegenRate();
	}

	if (regen > 0)
		this.Increase(regen);
	else
		this.Reduce(-regen);

	let threshold = 2
	let moraleLevel = this.GetMoraleLevel()
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
    if (moraleLevel <= 2)
    {
		this.ApplyMorale(this.entity)
    }
    else
    	this.RemoveMorale(this.entity)	
};

/*
 * Check if the regeneration timer needs to be started or stopped
 */
Morale.prototype.CheckRegenTimer = function()
{
	// check if we need a timer
	if (this.GetRegenRate() == 0 && this.GetIdleRegenRate() == 0 ||
	    this.Morale == this.GetMaxMorale() && this.GetRegenRate() >= 0 && this.GetIdleRegenRate() >= 0 ||
	    this.Morale == 0)
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
	this.regenTimer = cmpTimer.SetInterval(this.entity, IID_Morale, "ExecuteRegeneration", 1000, 1000, null);
};

/**
 * @param {number} amount - The amount of Morale to substract. Kills the entity if required.
 * @return {{ MoraleChange:number }} -  Number of Morale points lost.
 */
Morale.prototype.Reduce = function(amount)
{
	if (!amount || !this.Morale)
		return { "MoraleChange": 0 };

	let oldMorale = this.Morale;
	// If we reached 0, then die.
	if (amount >= this.Morale)
	{
		this.Morale = 0;
		this.RegisterMoraleChanged(oldMorale);
		return { "MoraleChange": -oldMorale };
	}

	this.Morale -= amount;
	this.RegisterMoraleChanged(oldMorale);
	return { "MoraleChange": this.Morale - oldMorale };
};


Morale.prototype.Increase = function(amount)
{
	let old = this.Morale;
	this.Morale = Math.min(this.Morale + amount, this.GetMaxMorale());

	this.RegisterMoraleChanged(old);

	return { "old": old, "new": this.Morale };
};


Morale.prototype.RecalculateValues = function()
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
		this.CheckRegenTimer();
};
// For Morale Influence

Morale.prototype.ApplyMorale = function(ents)
{
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	cmpModifiersManager.AddModifiers(
		"LowMorale", 
		{
			"UnitMotion/WalkSpeed": [{ "affects": ["Unit"], "multiply": 0.75 }],
			"Attack/Melee/RepeatTime": [{ "affects": ["Unit"], "multiply": 1.25 }],
			"Attack/Ranged/RepeatTime": [{ "affects": ["Unit"], "multiply": 1.25 }],
			"Builder/Rate": [{ "affects": ["Unit"], "multiply": 0.75 }],
			"ResourceGatherer/BaseSpeed": [{ "affects": ["Unit"], "multiply": 0.75 }]
		},
		ents
	);
}

Morale.prototype.RemoveMorale = function(ents)
{
	if (!ents.length)
		return;
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	cmpModifiersManager.RemoveAllModifiers("LowMorale", ents);
}

Morale.prototype.ApplyMoraleInfluence = function(ents)
{
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	cmpModifiersManager.AddModifiers(
		"MoraleSupport", 
		{
			"Morale/RegenRate": [{ "affects": ["Unit"], "add": 1 }]
		},
		ents
	);
}

Morale.prototype.RemoveMoraleInfluence = function(ents)
{
	if (!ents.length)
		return;
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	cmpModifiersManager.RemoveAllModifiers("MoraleSupport", ents);
}

Morale.prototype.CleanMoraleInfluence = function()
{
	var cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	
	//Remove Morale
	let targetUnitsClone = [];
	if (this.targetUnits)
	{
		targetUnitsClone = this.targetUnits.slice();
		this.RemoveMoraleInfluence(this.targetUnits);		
	}
	
	if (this.rangeQuery)
		cmpRangeManager.DestroyActiveQuery(this.rangeQuery);

	//Add Morale
	//this.CalculateAffectedPlayers();

	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (!cmpPlayer)
		cmpPlayer = QueryOwnerInterface(this.entity);

	if (!cmpPlayer || cmpPlayer.GetState() == "defeated")
		return;

	this.targetUnits = [];

	let affectedPlayers = cmpPlayer.GetAllies();
	this.rangeQuery = cmpRangeManager.CreateActiveQuery(
		this.entity,
		0,
		10,
		affectedPlayers,
		IID_Identity,
		cmpRangeManager.GetEntityFlagMask("normal"),
		false
	);
	cmpRangeManager.EnableActiveQuery(this.rangeQuery);

}

Morale.prototype.CalculateAffectedPlayers = function()
{
	var affectedPlayers = ["Player"];
	this.affectedPlayers = [];

	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (!cmpPlayer)
		cmpPlayer = QueryOwnerInterface(this.entity);

	if (!cmpPlayer || cmpPlayer.GetState() == "defeated")
		return;

	let cmpPlayerManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_PlayerManager);
	for (let i of cmpPlayerManager.GetAllPlayers())
	{
		let cmpAffectedPlayer = QueryPlayerIDInterface(i);
		if (!cmpAffectedPlayer || cmpAffectedPlayer.GetState() == "defeated")
			continue;

		if (affectedPlayers.some(p => p == "Player" ? cmpPlayer.GetPlayerID() == i : cmpPlayer["Is" + p](i)))
			this.affectedPlayers.push(i);
	}
};

Morale.prototype.OnRangeUpdate = function(msg)
{
	if(this.rangeQuery)
	{
		this.ApplyMoraleInfluence(msg.added);
		this.RemoveMoraleInfluence(msg.removed);
	}
}


Morale.prototype.OnValueModification = function(msg)
{
	if (msg.component == "Morale")
		this.RecalculateValues();
};

Morale.prototype.OnOwnershipChanged = function(msg)
{
	this.CleanMoraleInfluence();
	if (msg.to != INVALID_PLAYER)
		this.RecalculateValues();
};

Morale.prototype.OnDiplomacyChanged = function(msg)
{
	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (cmpPlayer && (cmpPlayer.GetPlayerID() == msg.player || cmpPlayer.GetPlayerID() == msg.otherPlayer) ||
	   IsOwnedByPlayer(msg.player, this.entity) ||
	   IsOwnedByPlayer(msg.otherPlayer, this.entity))
		this.CleanMoraleInfluence();
};

Morale.prototype.RegisterMoraleChanged = function(from)
{
	this.CheckRegenTimer();
	Engine.PostMessage(this.entity, MT_MoraleChanged, { "from": from, "to": this.Morale });
};

Engine.RegisterComponentType(IID_Morale, "Morale", Morale);
