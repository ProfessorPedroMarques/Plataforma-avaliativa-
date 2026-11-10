
const API_URL = "http://localhost:3000";

const serverStatus = document.getElementById("server-status");
const databaseStatus = document.getElementById("database-status");

const connectionMessage = document.getElementById(
    "connection-message"
);

const testButton = document.getElementById("test-connection");

// Atualiza os indicadores visuais
function updateStatus(element, status, message) {
    element.textContent = message;

    element.classList.remove(
        "online",
        "waiting",
        "error"
    );

    element.classList.add(status);
}

// Testa a conexão com a API e o banco
async function testConnection() {
    testButton.disabled = true;
    testButton.textContent = "Verificando...";

    updateStatus(
        serverStatus,
        "waiting",
        "Verificando..."
    );

    updateStatus(
        databaseStatus,
        "waiting",
        "Verificando..."
    );

    connectionMessage.textContent =
        "Consultando servidor e banco de dados...";

    try {
        const response = await fetch(
            `${API_URL}/api/health`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message);
        }

        updateStatus(
            serverStatus,
            "online",
            "Conectado"
        );

        updateStatus(
            databaseStatus,
            "online",
            "Conectado"
        );

        connectionMessage.textContent =
            "Servidor e PostgreSQL funcionando corretamente.";

    } catch (error) {

        updateStatus(
            serverStatus,
            "error",
            "Indisponível"
        );

        updateStatus(
            databaseStatus,
            "error",
            "Não verificado"
        );

        connectionMessage.textContent =
            "Falha na comunicação: " + error.message;

        console.error("Erro de conexão:", error);

    } finally {

        testButton.disabled = false;
        testButton.textContent =
            "Testar conexão novamente";
    }
}

// Evento do botão
testButton.addEventListener(
    "click",
    testConnection
);

// Verificação inicial
testConnection();
