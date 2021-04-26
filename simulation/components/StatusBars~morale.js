const g_NaturalColor = "255 255 255 255"; // pure white
/**
 * For every sprite, the code will call their "Add" method when regenerating
 * the sprites. Every sprite adder should return the height it needs.
 *
 * Modders who need extra sprites can just modify this array, and
 * provide the right methods.
 */
StatusBars.prototype.Sprites = [
	"ExperienceBar",
	"PackBar",
	"UpgradeBar",
	"ResourceSupplyBar",
	"CaptureBar",
	"HealthBar",
	"AuraIcons",
	"RankIcon",
	"MoraleIcon"
];

StatusBars.prototype.OnMoraleChanged = function(msg)
{
	if (this.enabled)
		this.RegenerateSprites();
};

StatusBars.prototype.AddMoraleBar = function(cmpOverlayRenderer, yoffset)
{
	if (!this.enabled)
		return 0;

	let cmpMorale = QueryMiragedInterface(this.entity, IID_Morale);
	if (!cmpMorale || cmpMorale.GetMorale() < 0)
		return 0;

	return this.AddBar(cmpOverlayRenderer, yoffset, "morale", cmpMorale.GetMorale() / cmpMorale.GetMaxMorale());
};

StatusBars.prototype.AddMoraleIcon = function(cmpOverlayRenderer, yoffset)
{
	if (!this.enabled)
		return 0;

	let cmpMorale = Engine.QueryInterface(this.entity, IID_Morale);
	if (!cmpMorale)
		return 0;

	let iconSize = +this.template.BarWidth / 2;
	cmpOverlayRenderer.AddSprite(
		"art/textures/ui/session/icons/morale/" + cmpMorale.GetMoraleLevel() + ".png",
		{ "x": -iconSize / 2, "y": yoffset },
		{ "x": iconSize / 2, "y": iconSize + yoffset },
		{ "x": 0, "y": +this.template.HeightOffset + 0.1, "z": 0 },
		g_NaturalColor);

	return iconSize + this.template.BarHeight / 2;
};
Engine.ReRegisterComponentType(IID_StatusBars, "StatusBars", StatusBars);
