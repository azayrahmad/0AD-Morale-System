Engine.RegisterInterface("Morale");

/**
 * Message of the form { "from": number, "to": number }
 * sent from Morale component whenever Morale changes.
 */
Engine.RegisterMessageType("MoraleChanged");
