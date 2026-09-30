# 🤖 Автоматична генерація клієнтських SDK (Client Generation)

Специфікація **OpenAPI 3.0** ([`docs/openapi.yaml`](file:///d:/SF%20k/docs/openapi.yaml) / [`docs/openapi.json`](file:///d:/SF%20k/docs/openapi.json)) дозволяє автоматично генерувати суворо типізовані клієнтські бібліотеки для будь-якої платформи без ручного написання мережевих запитів.

---

## 🛠️ Інструмент генерації: OpenAPI Generator

Рекомендований офіційний інструмент — [`@openapitools/openapi-generator-cli`](https://openapi-generator.tech/).

Встановлення через npm або pnpm:
```bash
npm install -g @openapitools/openapi-generator-cli
# або запуск без встановлення через npx:
npx @openapitools/openapi-generator-cli version
```

---

## 📱 1. Генерація Kotlin SDK для Android додатку (`sl-bot-remote`)

Для синхронізації типів та REST-запитів між бекендом та мобільним клієнтом `sl-bot-remote`:

### Команда генерації:
```bash
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g kotlin \
  -o sl-bot-remote/app/src/main/java/com/sf/bot/remote/api \
  --additional-properties=library=jvm-retrofit2,useCoroutines=true,dateLibrary=java8
```

### Переваги для Android:
- Створюються моделі даних `data class` із повною серіалізацією (Moshi / Gson).
- Створюються інтерфейси **Retrofit 2** з підтримкою `suspend` функцій Kotlin Coroutines.
- Гарантована відсутність розбіжностей у назвах полів між сервером та мобільним додатком.

---

## 🌐 2. Генерація TypeScript Axios / Fetch SDK для Web Frontend

Для використання в `frontend/src`:

### Команда генерації:
```bash
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g typescript-axios \
  -o frontend/src/api-client \
  --additional-properties=supportsES6=true,npmName=@sf/api-client
```

### Приклад використання у React компоненті:
```typescript
import { ProjectsApi, Configuration } from '@/api-client';

const apiConfig = new Configuration({
  basePath: 'http://localhost:3001',
  accessToken: localStorage.getItem('jwt_token') || undefined
});

const projectsApi = new ProjectsApi(apiConfig);

export async function fetchProjects() {
  const response = await projectsApi.apiProjectsGet();
  return response.data.data;
}
```

---

## 🐍 3. Генерація Python клієнта для автоматизації та тестів

Для аналітичних скриптів, Discord ботів або інтеграційних тестів:

### Команда генерації:
```bash
npx @openapitools/openapi-generator-cli generate \
  -i docs/openapi.yaml \
  -g python \
  -o scripts/python-sdk \
  --additional-properties=packageName=sf_bot_client
```

### Приклад використання у Python:
```python
import sf_bot_client
from sf_bot_client.api import projects_api

configuration = sf_bot_client.Configuration(
    host="http://localhost:3001",
    access_token="your_jwt_token"
)

with sf_bot_client.ApiClient(configuration) as api_client:
    api = projects_api.ProjectsApi(api_client)
    projects = api.api_projects_get()
    print("Активні проекти:", projects)
```

---

## 🔄 Автоматизація в CI/CD (GitHub Actions)

Ви можете додати крок перевірки або генерації клієнтів при кожній зміні `docs/openapi.yaml`:

```yaml
- name: Validate OpenAPI spec
  run: npx @openapitools/openapi-generator-cli validate -i docs/openapi.yaml
```
