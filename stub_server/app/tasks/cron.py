"""
Daily cron job — generates a new Instagram insights entry every day.

Uses APScheduler's AsyncIOScheduler with a cron trigger.
The schedule time and ig_user_ids are configured via environment variables.
"""

import os
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services.generator import generate_entry

logger = logging.getLogger("stub_server.cron")

# ── Configuration (from .env) ────────────────────────────────────────────────
# Time of day to run (24h format), e.g. "00:00" for midnight
CRON_HOUR = int(os.getenv("CRON_HOUR", "0"))
CRON_MINUTE = int(os.getenv("CRON_MINUTE", "0"))
# Timezone for the cron schedule, e.g. "Asia/Kolkata", "US/Pacific"
CRON_TIMEZONE = os.getenv("CRON_TIMEZONE", "UTC")
# Comma-separated list of ig_user_ids to generate data for
CRON_IG_USER_IDS = os.getenv("CRON_IG_USER_IDS", "default_user")

scheduler = AsyncIOScheduler()


async def daily_generate_task():
    """
    Generates today's insights entry for each configured ig_user_id.
    Called automatically by APScheduler on the configured schedule.
    """
    today = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    user_ids = [uid.strip() for uid in CRON_IG_USER_IDS.split(",") if uid.strip()]

    for ig_user_id in user_ids:
        try:
            entry = await generate_entry(ig_user_id, today)
            logger.info(
                f"✅ Generated entry for {ig_user_id} on {today.date()} — "
                f"views={entry.views}, reach={entry.reach}, "
                f"interactions={entry.total_interactions}"
            )
        except Exception as e:
            logger.error(f"❌ Failed to generate entry for {ig_user_id}: {e}")


def start_scheduler():
    """Start the APScheduler with the configured cron trigger."""
    trigger = CronTrigger(
        hour=CRON_HOUR,
        minute=CRON_MINUTE,
        timezone=CRON_TIMEZONE,
    )

    scheduler.add_job(
        daily_generate_task,
        trigger=trigger,
        id="daily_instagram_insights",
        name="Daily Instagram insights generation",
        replace_existing=True,
    )
    scheduler.start()

    logger.info(
        f"🕐 Cron scheduled: daily at {CRON_HOUR:02d}:{CRON_MINUTE:02d} {CRON_TIMEZONE} "
        f"for user(s): {CRON_IG_USER_IDS}"
    )


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🛑 Cron scheduler stopped.")
