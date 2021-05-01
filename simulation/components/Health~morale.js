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

Health.prototype.CreateCorpse = function()
{
	// If the unit died while not in the world, don't create any corpse for it
	// since there's nowhere for the corpse to be placed.
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (!cmpPosition || !cmpPosition.IsInWorld())
		return;

	// Either creates a static local version of the current entity, or a
	// persistent corpse retaining the ResourceSupply element of the parent.
	let templateName = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager).GetCurrentTemplateName(this.entity);

	let entCorpse;
	let cmpResourceSupply = Engine.QueryInterface(this.entity, IID_ResourceSupply);
	let resource = cmpResourceSupply && cmpResourceSupply.GetKillBeforeGather();
	if (resource)
		entCorpse = Engine.AddEntity("resource|" + templateName);
	else
		entCorpse = Engine.AddLocalEntity("corpse|" + templateName);

	// Copy various parameters so it looks just like us.
	let cmpPositionCorpse = Engine.QueryInterface(entCorpse, IID_Position);
	let pos = cmpPosition.GetPosition();
	cmpPositionCorpse.JumpTo(pos.x, pos.z);
	let rot = cmpPosition.GetRotation();
	cmpPositionCorpse.SetYRotation(rot.y);
	cmpPositionCorpse.SetXZRotation(rot.x, rot.z);

	let cmpOwnership = Engine.QueryInterface(this.entity, IID_Ownership);
	let cmpOwnershipCorpse = Engine.QueryInterface(entCorpse, IID_Ownership);
	if (cmpOwnership && cmpOwnershipCorpse)
		cmpOwnershipCorpse.SetOwner(cmpOwnership.GetOwner());

	let cmpVisualCorpse = Engine.QueryInterface(entCorpse, IID_Visual);
	if (cmpVisualCorpse)
	{
		let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
		if (cmpVisual)
			cmpVisualCorpse.SetActorSeed(cmpVisual.GetActorSeed());

		cmpVisualCorpse.SelectAnimation("death", true, 1);
	}

	let cmpMoraleInfluence = Engine.QueryInterface(this.entity, IID_MoraleInfluence);
	let cmpMoraleInfluenceCorpse = Engine.QueryInterface(entCorpse, IID_MoraleInfluence);
	if (cmpMoraleInfluence && cmpMoraleInfluenceCorpse)
		cmpMoraleInfluenceCorpse.SetSignificance(cmpMoraleInfluence.GetSignificance() * -1)

	if (resource)
		Engine.PostMessage(this.entity, MT_EntityRenamed, {
			"entity": this.entity,
			"newentity": entCorpse
		});
};

Engine.ReRegisterComponentType(IID_Health, "Health", Health);
