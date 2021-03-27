Attack.prototype.PerformAttack = function(type, target)
{
	let attackerOwner = Engine.QueryInterface(this.entity, IID_Ownership).GetOwner();

	// If this is a ranged attack, then launch a projectile
	if (type == "Ranged")
	{
		let cmpTimer = Engine.QueryInterface(SYSTEM_ENTITY, IID_Timer);
		let turnLength = cmpTimer.GetLatestTurnLength()/1000;
		// In the future this could be extended:
		//  * Obstacles like trees could reduce the probability of the target being hit
		//  * Obstacles like walls should block projectiles entirely

		let horizSpeed = +this.template[type].Projectile.Speed;
		let gravity = +this.template[type].Projectile.Gravity;
		// horizSpeed /= 2; gravity /= 2; // slow it down for testing

		// We will try to estimate the position of the target, where we can hit it.
		// We first estimate the time-till-hit by extrapolating linearly the movement
		// of the last turn. We compute the time till an arrow will intersect the target.
		let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
		if (!cmpPosition || !cmpPosition.IsInWorld())
			return;
		let selfPosition = cmpPosition.GetPosition();
		let cmpTargetPosition = Engine.QueryInterface(target, IID_Position);
		if (!cmpTargetPosition || !cmpTargetPosition.IsInWorld())
			return;
		let targetPosition = cmpTargetPosition.GetPosition();

		let targetVelocity = Vector3D.sub(targetPosition, cmpTargetPosition.GetPreviousPosition()).div(turnLength);

		let timeToTarget = PositionHelper.PredictTimeToTarget(selfPosition, horizSpeed, targetPosition, targetVelocity);

		// 'Cheat' and use UnitMotion to predict the position in the near-future.
		// This avoids 'dancing' issues with units zigzagging over very short distances.
		// However, this could fail if the player gives several short move orders, so
		// occasionally fall back to basic interpolation.
		let predictedPosition = targetPosition;
		if (timeToTarget !== false)
		{
			// Don't predict too far in the future, but avoid threshold effects.
			// After 1 second, always use the 'dumb' interpolated past-motion prediction.
			let useUnitMotion = randBool(Math.max(0, 0.75 - timeToTarget / 1.333));
			if (useUnitMotion)
			{
				let cmpTargetUnitMotion = Engine.QueryInterface(target, IID_UnitMotion);
				let cmpTargetUnitAI = Engine.QueryInterface(target, IID_UnitAI);
				if (cmpTargetUnitMotion && (!cmpTargetUnitAI || !cmpTargetUnitAI.IsFormationMember()))
				{
					let pos2D = cmpTargetUnitMotion.EstimateFuturePosition(timeToTarget);
					predictedPosition.x = pos2D.x;
					predictedPosition.z = pos2D.y;
				}
				else
					predictedPosition = Vector3D.mult(targetVelocity, timeToTarget).add(targetPosition);
			}
			else
				predictedPosition = Vector3D.mult(targetVelocity, timeToTarget).add(targetPosition);
		}

		let predictedHeight = cmpTargetPosition.GetHeightAt(predictedPosition.x, predictedPosition.z);

		// Add inaccuracy based on spread.
		let distanceModifiedSpread = ApplyValueModificationsToEntity("Attack/Ranged/Spread", +this.template[type].Projectile.Spread, this.entity) *
			predictedPosition.horizDistanceTo(selfPosition) / 100;

		let randNorm = randomNormal2D();
		let offsetX = randNorm[0] * distanceModifiedSpread;
		let offsetZ = randNorm[1] * distanceModifiedSpread;

		let realTargetPosition = new Vector3D(predictedPosition.x + offsetX, predictedHeight, predictedPosition.z + offsetZ);

		// Recalculate when the missile will hit the target position.
		let realHorizDistance = realTargetPosition.horizDistanceTo(selfPosition);
		timeToTarget = realHorizDistance / horizSpeed;

		let missileDirection = Vector3D.sub(realTargetPosition, selfPosition).div(realHorizDistance);

		// Launch the graphical projectile.
		let cmpProjectileManager = Engine.QueryInterface(SYSTEM_ENTITY, IID_ProjectileManager);

		let actorName = "";
		let impactActorName = "";
		let impactAnimationLifetime = 0;

		actorName = this.template[type].Projectile.ActorName || "";
		impactActorName = this.template[type].Projectile.ImpactActorName || "";
		impactAnimationLifetime = this.template[type].Projectile.ImpactAnimationLifetime || 0;

		// TODO: Use unit rotation to implement x/z offsets.
		let deltaLaunchPoint = new Vector3D(0, +this.template[type].Projectile.LaunchPoint["@y"], 0);
		let launchPoint = Vector3D.add(selfPosition, deltaLaunchPoint);

		let cmpVisual = Engine.QueryInterface(this.entity, IID_Visual);
		if (cmpVisual)
		{
			// if the projectile definition is missing from the template
			// then fallback to the projectile name and launchpoint in the visual actor
			if (!actorName)
				actorName = cmpVisual.GetProjectileActor();

			let visualActorLaunchPoint = cmpVisual.GetProjectileLaunchPoint();
			if (visualActorLaunchPoint.length() > 0)
				launchPoint = visualActorLaunchPoint;
		}

		let id = cmpProjectileManager.LaunchProjectileAtPoint(launchPoint, realTargetPosition, horizSpeed, gravity, actorName, impactActorName, impactAnimationLifetime);

		let attackImpactSound = "";
		let cmpSound = Engine.QueryInterface(this.entity, IID_Sound);
		if (cmpSound)
			attackImpactSound = cmpSound.GetSoundGroup("attack_impact_" + type.toLowerCase());

		let data = {
			"type": type,
			"attackData": this.GetAttackEffectsData(type),
			"target": target,
			"attacker": this.entity,
			"attackerOwner": attackerOwner,
			"position": realTargetPosition,
			"direction": missileDirection,
			"projectileId": id,
			"attackImpactSound": attackImpactSound,
			"splash": this.GetSplashData(type),
			"friendlyFire": this.template[type].Projectile.FriendlyFire == "true",
		};

		cmpTimer.SetTimeout(SYSTEM_ENTITY, IID_DelayedDamage, "MissileHit", +this.template[type].Delay + timeToTarget * 1000, data);

		let cmpMorale = Engine.QueryInterface(target, IID_Morale);
		if (cmpMorale)
		{		
			let reducedMorale = cmpMorale.GetMoraleDamageAttacked();
			cmpTimer.SetTimeout(target, IID_Morale, "ReduceMorale", +this.template[type].Delay + timeToTarget * 1000, reducedMorale);
		}
	}
	else
	{
		Attacking.HandleAttackEffects(target, type, this.GetAttackEffectsData(type), this.entity, attackerOwner);
		let cmpMorale = Engine.QueryInterface(target, IID_Morale);
		if (cmpMorale)
		{		
			let reducedMorale = cmpMorale.GetMoraleDamageAttacked();
			cmpMorale.ReduceMorale(reducedMorale);
		}
	}

};

Engine.ReRegisterComponentType(IID_Attack, "Attack", Attack);
