"""
train_up_mandis.py — DB mein jo bhi data hai uspe global reversion model retrain karo.
UP mandi seed ke baad run karo taaki predict endpoint UP crops ke liye bhi kaam kare.

    python train_up_mandis.py
"""

import sys, os, logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import MandiDB
from model_trainer import MandiModelTrainer

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("train_up")


def train():
    db = MandiDB()
    trainer = MandiModelTrainer()
    log.info("Reversion model training on all DB data (incl. UP mandis)...")
    model = trainer.train_reversion(db)
    if model:
        log.info("Model training complete and saved.")
    else:
        log.error("Training returned None — check DB data.")


if __name__ == "__main__":
    train()
