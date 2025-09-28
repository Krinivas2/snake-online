"""Terminal-based Sonic runner game.

This module implements a lightweight text-mode game inspired by the Sonic the
Hedgehog series. The player guides Sonic through three lanes, collecting rings
and avoiding Badniks. The game is purposely self-contained so it can be run in
any standard Python environment without the need for external libraries.

Example
-------
Run the game from the command line::

    python3 sonic_game.py

Controls
--------
- ``w``: Move Sonic up one lane.
- ``s``: Move Sonic down one lane.
- ``d``: Activate a spin dash for one turn to destroy the next obstacle.
- ``Enter``: Keep Sonic in the current lane.
- ``q``: Quit the game early.
"""
from __future__ import annotations

import os
import random
import sys
import textwrap
import time
from dataclasses import dataclass, field
from typing import List


LANE_SYMBOLS = {0: "☁", 1: "=", 2: "☘"}
SONIC_SYMBOLS = {"normal": "🐿", "dash": "🌀"}
OBSTACLE_SYMBOL = "✖"
RING_SYMBOL = "○"
POWERUP_SYMBOL = "★"
EMPTY_SYMBOL = "·"


@dataclass
class Entity:
    """Represents a collectible or obstacle on the track."""

    lane: int
    position: int
    kind: str
    points: int = 0
    damage: int = 0

    def icon(self) -> str:
        if self.kind == "ring":
            return RING_SYMBOL
        if self.kind == "obstacle":
            return OBSTACLE_SYMBOL
        if self.kind == "shield":
            return POWERUP_SYMBOL
        return "?"


@dataclass
class Sonic:
    """State of the Sonic character."""

    lane: int = 1
    lives: int = 3
    rings: int = 0
    score: int = 0
    invincible_turns: int = 0
    dash_ready: bool = True
    dash_active: bool = False

    def move(self, direction: int) -> None:
        """Move Sonic between the three lanes."""
        self.lane = max(0, min(2, self.lane + direction))

    def activate_dash(self) -> bool:
        if not self.dash_ready:
            return False
        self.dash_ready = False
        self.dash_active = True
        return True

    def end_turn(self) -> None:
        if self.invincible_turns:
            self.invincible_turns -= 1
        self.dash_active = False


@dataclass
class SonicRunnerGame:
    width: int = 24
    spawn_chance: float = 0.55
    speed_increase_interval: int = 8
    entities: List[Entity] = field(default_factory=list)
    sonic: Sonic = field(default_factory=Sonic)
    tick: int = 0
    delay: float = 0.6

    def clear_screen(self) -> None:
        if sys.stdout.isatty():
            os.system("cls" if os.name == "nt" else "clear")

    def intro(self) -> None:
        message = textwrap.dedent(
            """
            ================= SONIC RUNNER =================
            Robotnik has unleashed a swarm of Badniks! Help Sonic dash through
            Green Hill Zone, grab rings, and avoid danger. Survive as long as
            you can and rack up the highest score.

            Controls: [w] up  [s] down  [d] spin dash  [Enter] stay  [q] quit
            """
        )
        print(message)
        input("Press Enter to start the adventure!")

    def spawn_entities(self) -> None:
        if random.random() > self.spawn_chance:
            return

        lane = random.randint(0, 2)
        position = self.width - 1
        roll = random.random()
        if roll < 0.6:
            self.entities.append(Entity(lane=lane, position=position, kind="ring", points=100))
        elif roll < 0.9:
            damage = 1
            self.entities.append(Entity(lane=lane, position=position, kind="obstacle", damage=damage))
        else:
            self.entities.append(Entity(lane=lane, position=position, kind="shield", points=0))

    def update_entities(self) -> None:
        for entity in list(self.entities):
            entity.position -= 1
            if entity.position < 0:
                self.entities.remove(entity)

    def draw_track(self) -> str:
        rows = []
        for lane in range(3):
            row = [LANE_SYMBOLS[lane]]
            for col in range(self.width):
                row.append(EMPTY_SYMBOL)
            rows.append(row)

        for entity in self.entities:
            if 0 <= entity.position < self.width:
                rows[entity.lane][entity.position + 1] = entity.icon()

        sonic_symbol = SONIC_SYMBOLS["dash"] if self.sonic.dash_active else SONIC_SYMBOLS["normal"]
        rows[self.sonic.lane][1] = sonic_symbol
        rendered_rows = ["".join(row) for row in rows]

        hud = (
            f"Score: {self.sonic.score:05d}  Rings: {self.sonic.rings:02d}  "
            f"Lives: {self.sonic.lives}  Speed LVL: {1 + self.tick // self.speed_increase_interval}"
        )
        dash_status = "READY" if self.sonic.dash_ready else ("ACTIVE" if self.sonic.dash_active else "RECHARGE")
        hud += f"  Spin Dash: {dash_status}"
        if self.sonic.invincible_turns:
            hud += "  Shield: ON"

        return "\n".join([hud, ""] + rendered_rows)

    def handle_collisions(self) -> None:
        for entity in list(self.entities):
            if entity.position == 0 and entity.lane == self.sonic.lane:
                if entity.kind == "ring":
                    self.sonic.rings += 1
                    self.sonic.score += entity.points
                    self.entities.remove(entity)
                elif entity.kind == "shield":
                    self.sonic.invincible_turns = 3
                    self.entities.remove(entity)
                elif entity.kind == "obstacle":
                    if self.sonic.dash_active:
                        self.sonic.score += 250
                        self.entities.remove(entity)
                    elif self.sonic.invincible_turns:
                        self.entities.remove(entity)
                    else:
                        if self.sonic.rings:
                            lost = min(self.sonic.rings, 10)
                            self.sonic.rings -= lost
                            self.entities.remove(entity)
                        else:
                            self.sonic.lives -= entity.damage or 1
                            self.entities.remove(entity)

    def player_input(self) -> str:
        try:
            command = input("Move [w/s/d/Enter/q]: ").strip().lower()
        except EOFError:
            return "q"
        return command

    def apply_input(self, command: str) -> bool:
        if not command:
            return True
        if command == "w":
            self.sonic.move(-1)
        elif command == "s":
            self.sonic.move(1)
        elif command == "d":
            if not self.sonic.activate_dash():
                print("Spin dash is recharging!")
                time.sleep(0.5)
        elif command == "q":
            return False
        return True

    def recharge_dash(self) -> None:
        if not self.sonic.dash_ready and not self.sonic.dash_active:
            # Recharge after a short cooldown
            cooldown = 2
            if self.tick % cooldown == 0:
                self.sonic.dash_ready = True

    def game_over(self) -> None:
        message = textwrap.dedent(
            f"""
            ================= GAME OVER =================
            Sonic ran out of rings and could not keep up...
            Final Score: {self.sonic.score}
            Rings Collected: {self.sonic.rings}
            Turns Survived: {self.tick}
            Thanks for playing!
            """
        )
        print(message)

    def run(self) -> None:
        random.seed()
        self.clear_screen()
        self.intro()

        while self.sonic.lives > 0:
            self.clear_screen()
            self.spawn_entities()
            self.update_entities()
            self.handle_collisions()
            print(self.draw_track())

            command = self.player_input()
            if not self.apply_input(command):
                break

            # Extend dash through this frame only
            self.recharge_dash()
            self.sonic.end_turn()

            self.tick += 1
            if self.tick % self.speed_increase_interval == 0 and self.delay > 0.2:
                self.delay = max(0.2, self.delay - 0.05)
            time.sleep(self.delay)

        self.game_over()


def main() -> None:
    game = SonicRunnerGame()
    game.run()


if __name__ == "__main__":
    main()
