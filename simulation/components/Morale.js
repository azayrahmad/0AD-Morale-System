function Morale() {}

Morale.prototype.Schema =
	"<a:help>Deals with Morale.</a:help>" +
	"<a:example>" +
		"<Max>100</Max>" +
		"<RegenRate>1.0</RegenRate>" +
		"<IdleRegenRate>0</IdleRegenRate>" +
		"<Range>10</Range>" +
	"</a:example>" +
	"<element name='Max' a:help='Maximum Morale'>" +
		"<ref name='nonNegativeDecimal'/>" +
	"</element>" +
	"<optional>" +
		"<element name='Initial' a:help='Initial Morale. Default if unspecified is equal to Max'>" +
			"<ref name='nonNegativeDecimal'/>" +
		"</element>" +
	"</optional>" +
	"<element name='RegenRate' a:help='Morale regeneration rate per second.'>" +
		"<data type='decimal'/>" +
	"</element>" +
	"<element name='IdleRegenRate' a:help='Morale regeneration rate per second when idle or garrisoned.'>" +
		"<data type='decimal'/>" +
	"</element>" +
	"<element name='Range' a:help='Range of morale influence.'>" +
		"<data type='decimal'/>" +
	"</element>";

Morale.prototype.Init = function()
{
	this.affectedPlayers = [];
	this.affectedPlayersEnemies = [];

	// Cache this value so it allows techs to maintain previous morale level
	this.maxMorale = +this.template.Max;
	// Default to <Initial>, but use <Max> if it's undefined or zero
	this.Morale = +(this.template.Initial || this.GetMaxMorale());
	this.regenRate = ApplyValueModificationsToEntity("Morale/RegenRate", +this.template.RegenRate, this.entity);
	this.idleRegenRate = ApplyValueModificationsToEntity("Morale/IdleRegenRate", +this.template.IdleRegenRate, this.entity);

	this.CheckMoraleRegenTimer();	
	this.CleanMoraleInfluence();
};

Morale.prototype.GetMorale = function()
{
	return this.Morale;
};

Morale.prototype.GetMoraleLevel = function()
{
	return this.Morale == 0 ? 1 : Math.ceil(this.Morale / 20);
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
		this.IncreaseMorale(regen);
	else
		this.ReduceMorale(-regen);

	let threshold = 2
	let moraleLevel = this.GetMoraleLevel()
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
    if (moraleLevel <= 2)
		this.ApplyMoraleEffects(this.entity)
    else
    	this.RemoveMoraleEffects(this.entity)	
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
	this.regenTimer = cmpTimer.SetInterval(this.entity, IID_Morale, "ExecuteRegeneration", 1000, 1000, null);
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
	// If we reached 0, then stop reducing.
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


Morale.prototype.IncreaseMorale = function(amount)
{
	let old = this.Morale;
	this.Morale = Math.min(this.Morale + amount, this.GetMaxMorale());

	this.RegisterMoraleChanged(old);

	return { "old": old, "new": this.Morale };
};

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

Morale.prototype.ApplyMoraleEffects = function(ent)
{
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	//TODO: Make this modifiable via template
	cmpModifiersManager.AddModifiers(
		"Demoralized", 
		{
			"UnitMotion/WalkSpeed": [{ "affects": ["Unit"], "multiply": 0.75 }],
			"Attack/Melee/RepeatTime": [{ "affects": ["Unit"], "multiply": 1.25 }],
			"Attack/Ranged/RepeatTime": [{ "affects": ["Unit"], "multiply": 1.25 }],
			"Builder/Rate": [{ "affects": ["Unit"], "multiply": 0.75 }],
			"ResourceGatherer/BaseSpeed": [{ "affects": ["Unit"], "multiply": 0.75 }]
		},
		ent
	);
}

Morale.prototype.RemoveMoraleEffects = function(ents)
{
	if (!ents.length)
		return;
	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	cmpModifiersManager.RemoveAllModifiers("Demoralized", ents);
}

//
// For Morale Influence
//
// Applying morale influence by updating regenRate of all entities in range.
Morale.prototype.ApplyMoraleInfluence = function(ents, ally)
{
	//Calculate morale influence
	//TODO: multiply by Morale Level
	let moraleInfluence =  (ally ? 1 : -1)
	if (moraleInfluence == 0)
		return;

	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
	for (let ent of ents)
	{
		var cmpMorale = Engine.QueryInterface(ent, IID_Morale);
		cmpModifiersManager.AddModifiers(
			(ally ? "MoraleAllies" : "MoraleEnemies") + ent, 
			{
				"Morale/RegenRate": [{ "affects": ["Unit"], "add": moraleInfluence * (cmpMorale ? cmpMorale.GetMoraleLevel() / 5 : 1) }],
			},
			this.entity,
			true
		);
	}
}

//Alternative Morale Apply by updating unit regenRate based on amount entities in range. Not currently used
Morale.prototype.ApplyMoraleInfluenceAlt = function(ents, ally)
{
	let moraleInfluence =  (ally ? 1 : -1)
	if (moraleInfluence == 0)
		return;

	var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);

	if (ents)
	{
		let oldRegenRate = this.regenRate
		this.regenRate = +this.template.RegenRate + (moraleInfluence * ents.length);
		if (oldRegenRate != this.regenRate )
			this.CheckMoraleRegenTimer();

	}
}

Morale.prototype.RemoveMoraleInfluence = function(ents, ally)
{
	if (!ents.length)
		return;
	for (let ent of ents)
	{
		var cmpModifiersManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ModifiersManager);
		cmpModifiersManager.RemoveAllModifiers((ally ? "MoraleAllies" : "MoraleEnemies") + ent, this.entity);
	}

}

Morale.prototype.CleanMoraleInfluence = function()
{
	var cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);

	if(this.affectedPlayers)
		this.RemoveMoraleInfluence(this.affectedPlayers, true);
	if(this.affectedPlayersEnemies)
		this.RemoveMoraleInfluence(this.affectedPlayersEnemies, false);
    this.RemoveMoraleInfluence([this.entity], false);

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

	this.affectedPlayers = cmpPlayer.GetAllies();
	this.rangeQuery = cmpRangeManager.CreateActiveQuery(
		this.entity,
		0,
		this.template.Range,
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
		this.template.Range,
		this.affectedPlayersEnemies,
		IID_Identity,
		cmpRangeManager.GetEntityFlagMask("normal"),
		false
	);
	cmpRangeManager.EnableActiveQuery(this.rangeQueryEnemy);

}

Morale.prototype.OnRangeUpdate = function(msg)
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
}

Morale.prototype.OnValueModification = function(msg)
{
	if (msg.component == "Morale")
		this.RecalculateMoraleValues();
};

Morale.prototype.OnOwnershipChanged = function(msg)
{
	this.CleanMoraleInfluence();
	if (msg.to != INVALID_PLAYER)
		this.RecalculateMoraleValues();
};

Morale.prototype.OnDiplomacyChanged = function(msg)
{
	var cmpPlayer = Engine.QueryInterface(this.entity, IID_Player);
	if (cmpPlayer && (cmpPlayer.GetPlayerID() == msg.player || cmpPlayer.GetPlayerID() == msg.otherPlayer) ||
	   IsOwnedByPlayer(msg.player, this.entity) ||
	   IsOwnedByPlayer(msg.otherPlayer, this.entity))
		this.CleanMoraleInfluence();
};

Morale.prototype.OnDestroy = function(msg)
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
