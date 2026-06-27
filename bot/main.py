import asyncio
import logging

import click

from client import RoomBot

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@click.group()
def cli():
    pass


@cli.command()
@click.argument("room_id")
@click.option("--mp4", required=True, type=click.Path(exists=True), help="MP4 file to stream")
@click.option("--name", default="StreamBot", show_default=True, help="Bot display name")
@click.option("--server", default="http://localhost:8000", show_default=True, help="Backend server URL")
@click.option("--loop/--no-loop", default=True, show_default=True, help="Loop the MP4 file")
def join(room_id: str, mp4: str, name: str, server: str, loop: bool) -> None:
    """Join a Clubhouse room as a streaming bot."""
    asyncio.run(RoomBot(server, room_id, mp4, name, loop).run())


if __name__ == "__main__":
    cli()
