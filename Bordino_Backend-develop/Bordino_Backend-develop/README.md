# Backend

## Quick Start

```shell
git clone https://github.com/Lottery-System/Backend
cd Backend
virtualenv -p python3.10 venv
source venv/bin/activate
./run requirements.install.dev

cp main_app/.env.example main_app/.env
vim main_app/.env

docker compose -f ./docker-compose.dev.yml build
docker compose -f ./docker-compose.dev.yml up -d

docker ps -> get containe_id

docker exec -it <django_container_id> bash
# (in container)
python3 manage.py migrate
python3 manage.py createsuperuser
```

## Available Commands

- `./run pre_commit.init`
- `./run pre_commit.run_for_all`
- `./run requirements.compile`
- `./run requirements.install.dev`
- `./run requirements.install.prod`
- `./run web_entrypoint.dev`
- `./run web_entrypoint.prod`
