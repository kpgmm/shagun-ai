from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "shagun_db"
    JWT_SECRET: str = "change_this_secret"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {"env_file": ".env"}


settings = Settings()
