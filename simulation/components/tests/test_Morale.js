Engine.LoadComponentScript("interfaces/ModifiersManager.js");
Engine.LoadComponentScript("interfaces/ResourceSupply.js");
Engine.LoadHelperScript("Player.js");
Engine.LoadHelperScript("ValueModification.js");

Engine.LoadHelperScript("Sound.js");
Engine.LoadComponentScript("interfaces/DeathDamage.js");

Engine.LoadComponentScript("interfaces/Health.js");
Engine.LoadComponentScript("Health.js");

Engine.LoadComponentScript("Attack.js");

const entity_id = 5;

const morale_template = {
	"Max": 50,
	"RegenRate": 0,
	"IdleRegenRate": 0
};

function setEntityUp()
{
	let cmpMorale = ConstructComponent(entity_id, "Morale", morale_template);

	AddMock(entity_id, IID_Position, {
		"IsInWorld": () => true,
		"GetPosition": () => ({ "x": 0, "z": 0 }),
		"GetRotation": () => ({ "x": 0, "y": 0, "z": 0 })
	});
	AddMock(entity_id, IID_Ownership, {
		"GetOwner": () => 1
	});
	AddMock(entity_id, IID_Visual, {
		"GetActorSeed": () => 1
	});
	AddMock(SYSTEM_ENTITY, IID_TemplateManager, {
		"GetCurrentTemplateName": () => "test"
	});

	return cmpMorale;
}

var cmpMorale = setEntityUp();

TS_ASSERT_EQUALS(cmpMorale.GetMorale(), 50);
TS_ASSERT_EQUALS(cmpMorale.GetMaxMorale(), 50);

var change = cmpMorale.Reduce(25);
TS_ASSERT_EQUALS(injured_flag, true);

TS_ASSERT_EQUALS(change.MoraleChange, -25);
TS_ASSERT_EQUALS(cmpMorale.GetMorale(), 25);
TS_ASSERT_EQUALS(cmpMorale.GetMaxMorale(), 50);

change = cmpMorale.Increase(25);
TS_ASSERT_EQUALS(injured_flag, false);

TS_ASSERT_EQUALS(change.new, 50);
TS_ASSERT_EQUALS(cmpMorale.GetMorale(), 50);
TS_ASSERT_EQUALS(cmpMorale.GetMaxMorale(), 50);

change = cmpMorale.Reduce(50);
change = cmpMorale.Reduce(50);
TS_ASSERT_EQUALS(change.MoraleChange, 0);
TS_ASSERT_EQUALS(cmpMorale.GetMorale(), 0);
TS_ASSERT_EQUALS(cmpMorale.GetMaxMorale(), 50);

cmpMorale = setEntityUp();

change = cmpMorale.Reduce(60);
TS_ASSERT_EQUALS(change.MoraleChange, -50);
TS_ASSERT_EQUALS(cmpMorale.GetMorale(), 0);
TS_ASSERT_EQUALS(cmpMorale.GetMaxMorale(), 50);

cmpMorale = setEntityUp();

// Check that increasing by more than required puts us at the max Morale
change = cmpMorale.Reduce(30);
change = cmpMorale.Increase(30);
TS_ASSERT_EQUALS(change.new, 50);
TS_ASSERT_EQUALS(cmpMorale.GetMorale(), 50);
TS_ASSERT_EQUALS(cmpMorale.GetMaxMorale(), 50);

//TODO test morale effect
