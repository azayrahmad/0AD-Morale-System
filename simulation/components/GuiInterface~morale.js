/**
 * Get common entity info, often used in the gui.
 */
GuiInterface.prototype.GetEntityState = function(player, ent)
{
	let cmpTemplateManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_TemplateManager);

	// All units must have a template; if not then it's a nonexistent entity id.
	let template = cmpTemplateManager.GetCurrentTemplateName(ent);
	if (!template)
		return null;

	let ret = {
		"id": ent,
		"player": INVALID_PLAYER,
		"template": template
	};

	let cmpMirage = Engine.QueryInterface(ent, IID_Mirage);
	if (cmpMirage)
		ret.mirage = true;

	let cmpIdentity = Engine.QueryInterface(ent, IID_Identity);
	if (cmpIdentity)
		ret.identity = {
			"rank": cmpIdentity.GetRank(),
			"classes": cmpIdentity.GetClassesList(),
			"selectionGroupName": cmpIdentity.GetSelectionGroupName(),
			"canDelete": !cmpIdentity.IsUndeletable(),
			"hasSomeFormation": cmpIdentity.HasSomeFormation(),
			"formations": cmpIdentity.GetFormationsList(),
			"controllable": cmpIdentity.IsControllable()
		};

	let cmpPosition = Engine.QueryInterface(ent, IID_Position);
	if (cmpPosition && cmpPosition.IsInWorld())
		ret.position = cmpPosition.GetPosition();

	let cmpHealth = QueryMiragedInterface(ent, IID_Health);
	if (cmpHealth)
	{
		ret.hitpoints = cmpHealth.GetHitpoints();
		ret.maxHitpoints = cmpHealth.GetMaxHitpoints();
		ret.needsRepair = cmpHealth.IsRepairable() && cmpHealth.IsInjured();
		ret.needsHeal = !cmpHealth.IsUnhealable();
	}

	let cmpMorale = QueryMiragedInterface(ent, IID_Morale);
	if (cmpMorale)
	{
		ret.morale = cmpMorale.GetMorale();
		ret.maxMorale = cmpMorale.GetMaxMorale();
		ret.regenRate = cmpMorale.GetCurrentRegenRate();
	}

	let cmpCapturable = QueryMiragedInterface(ent, IID_Capturable);
	if (cmpCapturable)
	{
		ret.capturePoints = cmpCapturable.GetCapturePoints();
		ret.maxCapturePoints = cmpCapturable.GetMaxCapturePoints();
	}

	let cmpBuilder = Engine.QueryInterface(ent, IID_Builder);
	if (cmpBuilder)
		ret.builder = true;

	let cmpMarket = QueryMiragedInterface(ent, IID_Market);
	if (cmpMarket)
		ret.market = {
			"land": cmpMarket.HasType("land"),
			"naval": cmpMarket.HasType("naval")
		};

	let cmpPack = Engine.QueryInterface(ent, IID_Pack);
	if (cmpPack)
		ret.pack = {
			"packed": cmpPack.IsPacked(),
			"progress": cmpPack.GetProgress()
		};

	let cmpPopulation = Engine.QueryInterface(ent, IID_Population);
	if (cmpPopulation)
		ret.population = {
			"bonus": cmpPopulation.GetPopBonus()
		};

	let cmpUpgrade = Engine.QueryInterface(ent, IID_Upgrade);
	if (cmpUpgrade)
		ret.upgrade = {
			"upgrades": cmpUpgrade.GetUpgrades(),
			"progress": cmpUpgrade.GetProgress(),
			"template": cmpUpgrade.GetUpgradingTo(),
			"isUpgrading": cmpUpgrade.IsUpgrading()
		};

	let cmpStatusEffects = Engine.QueryInterface(ent, IID_StatusEffectsReceiver);
	if (cmpStatusEffects)
		ret.statusEffects = cmpStatusEffects.GetActiveStatuses();

	let cmpProductionQueue = Engine.QueryInterface(ent, IID_ProductionQueue);
	if (cmpProductionQueue)
		ret.production = {
			"entities": cmpProductionQueue.GetEntitiesList(),
			"technologies": cmpProductionQueue.GetTechnologiesList(),
			"techCostMultiplier": cmpProductionQueue.GetTechCostMultiplier(),
			"queue": cmpProductionQueue.GetQueue()
		};

	let cmpTrader = Engine.QueryInterface(ent, IID_Trader);
	if (cmpTrader)
		ret.trader = {
			"goods": cmpTrader.GetGoods()
		};

	let cmpFoundation = QueryMiragedInterface(ent, IID_Foundation);
	if (cmpFoundation)
		ret.foundation = {
			"numBuilders": cmpFoundation.GetNumBuilders(),
			"buildTime": cmpFoundation.GetBuildTime()
		};

	let cmpRepairable = QueryMiragedInterface(ent, IID_Repairable);
	if (cmpRepairable)
		ret.repairable = {
			"numBuilders": cmpRepairable.GetNumBuilders(),
			"buildTime": cmpRepairable.GetBuildTime()
		};

	let cmpOwnership = Engine.QueryInterface(ent, IID_Ownership);
	if (cmpOwnership)
		ret.player = cmpOwnership.GetOwner();

	let cmpRallyPoint = Engine.QueryInterface(ent, IID_RallyPoint);
	if (cmpRallyPoint)
		ret.rallyPoint = { "position": cmpRallyPoint.GetPositions()[0] }; // undefined or {x,z} object

	let cmpGarrisonHolder = Engine.QueryInterface(ent, IID_GarrisonHolder);
	if (cmpGarrisonHolder)
		ret.garrisonHolder = {
			"entities": cmpGarrisonHolder.GetEntities(),
			"buffHeal": cmpGarrisonHolder.GetHealRate(),
			"allowedClasses": cmpGarrisonHolder.GetAllowedClasses(),
			"capacity": cmpGarrisonHolder.GetCapacity(),
			"garrisonedEntitiesCount": cmpGarrisonHolder.GetGarrisonedEntitiesCount()
		};

	let cmpTurretHolder = Engine.QueryInterface(ent, IID_TurretHolder);
	if (cmpTurretHolder)
		ret.turretHolder = {
			"turretPoints": cmpTurretHolder.GetTurretPoints()
		};

	let cmpGarrisonable = Engine.QueryInterface(ent, IID_Garrisonable);
	if (cmpGarrisonable)
		ret.garrisonable = {
			"holder": cmpGarrisonable.HolderID()
		};

	let cmpUnitAI = Engine.QueryInterface(ent, IID_UnitAI);
	if (cmpUnitAI)
		ret.unitAI = {
			"state": cmpUnitAI.GetCurrentState(),
			"orders": cmpUnitAI.GetOrders(),
			"hasWorkOrders": cmpUnitAI.HasWorkOrders(),
			"canGuard": cmpUnitAI.CanGuard(),
			"isGuarding": cmpUnitAI.IsGuardOf(),
			"canPatrol": cmpUnitAI.CanPatrol(),
			"selectableStances": cmpUnitAI.GetSelectableStances(),
			"isIdle": cmpUnitAI.IsIdle()
		};

	let cmpGuard = Engine.QueryInterface(ent, IID_Guard);
	if (cmpGuard)
		ret.guard = {
			"entities": cmpGuard.GetEntities()
		};

	let cmpResourceGatherer = Engine.QueryInterface(ent, IID_ResourceGatherer);
	if (cmpResourceGatherer)
	{
		ret.resourceCarrying = cmpResourceGatherer.GetCarryingStatus();
		ret.resourceGatherRates = cmpResourceGatherer.GetGatherRates();
	}

	let cmpGate = Engine.QueryInterface(ent, IID_Gate);
	if (cmpGate)
		ret.gate = {
			"locked": cmpGate.IsLocked()
		};

	let cmpAlertRaiser = Engine.QueryInterface(ent, IID_AlertRaiser);
	if (cmpAlertRaiser)
		ret.alertRaiser = true;

	let cmpRangeManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_RangeManager);
	ret.visibility = cmpRangeManager.GetLosVisibility(ent, player);

	let cmpAttack = Engine.QueryInterface(ent, IID_Attack);
	if (cmpAttack)
	{
		let types = cmpAttack.GetAttackTypes();
		if (types.length)
			ret.attack = {};

		for (let type of types)
		{
			ret.attack[type] = {};

			Object.assign(ret.attack[type], cmpAttack.GetAttackEffectsData(type));

			ret.attack[type].attackName = cmpAttack.GetAttackName(type);

			ret.attack[type].splash = cmpAttack.GetSplashData(type);
			if (ret.attack[type].splash)
				Object.assign(ret.attack[type].splash, cmpAttack.GetAttackEffectsData(type, true));

			let range = cmpAttack.GetRange(type);
			ret.attack[type].minRange = range.min;
			ret.attack[type].maxRange = range.max;

			let timers = cmpAttack.GetTimers(type);
			ret.attack[type].prepareTime = timers.prepare;
			ret.attack[type].repeatTime = timers.repeat;

			if (type != "Ranged")
			{
				// Not a ranged attack, set some defaults.
				ret.attack[type].elevationBonus = 0;
				ret.attack[type].elevationAdaptedRange = ret.attack.maxRange;
				continue;
			}

			ret.attack[type].elevationBonus = range.elevationBonus;

			if (cmpPosition && cmpPosition.IsInWorld())
				// For units, take the range in front of it, no spread, so angle = 0,
				// else, take the average elevation around it: angle = 2 * pi.
				ret.attack[type].elevationAdaptedRange = cmpRangeManager.GetElevationAdaptedRange(cmpPosition.GetPosition(), cmpPosition.GetRotation(), range.max, range.elevationBonus, cmpUnitAI ? 0 : 2 * Math.PI);
			else
				// Not in world, set a default?
				ret.attack[type].elevationAdaptedRange = ret.attack.maxRange;
		}
	}

	let cmpResistance = Engine.QueryInterface(ent, IID_Resistance);
	if (cmpResistance)
		ret.resistance = cmpResistance.GetResistanceOfForm(cmpFoundation ? "Foundation" : "Entity");

	let cmpBuildingAI = Engine.QueryInterface(ent, IID_BuildingAI);
	if (cmpBuildingAI)
		ret.buildingAI = {
			"defaultArrowCount": cmpBuildingAI.GetDefaultArrowCount(),
			"maxArrowCount": cmpBuildingAI.GetMaxArrowCount(),
			"garrisonArrowMultiplier": cmpBuildingAI.GetGarrisonArrowMultiplier(),
			"garrisonArrowClasses": cmpBuildingAI.GetGarrisonArrowClasses(),
			"arrowCount": cmpBuildingAI.GetArrowCount()
		};

	if (cmpPosition && cmpPosition.GetTurretParent() != INVALID_ENTITY)
		ret.turretParent = cmpPosition.GetTurretParent();

	let cmpResourceSupply = QueryMiragedInterface(ent, IID_ResourceSupply);
	if (cmpResourceSupply)
		ret.resourceSupply = {
			"isInfinite": cmpResourceSupply.IsInfinite(),
			"max": cmpResourceSupply.GetMaxAmount(),
			"amount": cmpResourceSupply.GetCurrentAmount(),
			"type": cmpResourceSupply.GetType(),
			"killBeforeGather": cmpResourceSupply.GetKillBeforeGather(),
			"maxGatherers": cmpResourceSupply.GetMaxGatherers(),
			"numGatherers": cmpResourceSupply.GetNumGatherers()
		};

	let cmpResourceDropsite = Engine.QueryInterface(ent, IID_ResourceDropsite);
	if (cmpResourceDropsite)
		ret.resourceDropsite = {
			"types": cmpResourceDropsite.GetTypes(),
			"sharable": cmpResourceDropsite.IsSharable(),
			"shared": cmpResourceDropsite.IsShared()
		};

	let cmpPromotion = Engine.QueryInterface(ent, IID_Promotion);
	if (cmpPromotion)
		ret.promotion = {
			"curr": cmpPromotion.GetCurrentXp(),
			"req": cmpPromotion.GetRequiredXp()
		};

	if (!cmpFoundation && cmpIdentity && cmpIdentity.HasClass("Barter"))
		ret.isBarterMarket = true;

	let cmpHeal = Engine.QueryInterface(ent, IID_Heal);
	if (cmpHeal)
		ret.heal = {
			"health": cmpHeal.GetHealth(),
			"range": cmpHeal.GetRange().max,
			"interval": cmpHeal.GetInterval(),
			"unhealableClasses": cmpHeal.GetUnhealableClasses(),
			"healableClasses": cmpHeal.GetHealableClasses()
		};

	let cmpLoot = Engine.QueryInterface(ent, IID_Loot);
	if (cmpLoot)
	{
		ret.loot = cmpLoot.GetResources();
		ret.loot.xp = cmpLoot.GetXp();
	}

	let cmpResourceTrickle = Engine.QueryInterface(ent, IID_ResourceTrickle);
	if (cmpResourceTrickle)
		ret.resourceTrickle = {
			"interval": cmpResourceTrickle.GetInterval(),
			"rates": cmpResourceTrickle.GetRates()
		};

	let cmpUnitMotion = Engine.QueryInterface(ent, IID_UnitMotion);
	if (cmpUnitMotion)
		ret.speed = {
			"walk": cmpUnitMotion.GetWalkSpeed(),
			"run": cmpUnitMotion.GetWalkSpeed() * cmpUnitMotion.GetRunMultiplier()
		};

	return ret;
};

Engine.ReRegisterComponentType(IID_GuiInterface, "GuiInterface", GuiInterface);
