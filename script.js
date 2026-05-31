// ==========================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO DO BANCO DE DADOS FIREBASE
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDrKxpryIJRm0PgdO-Frnx0y1WNcY1BjHk",
  authDomain: "ecofila-fa5d8.firebaseapp.com",
  projectId: "ecofila-fa5d8",
  storageBucket: "ecofila-fa5d8.firebasestorage.app",
  messagingSenderId: "227124134203",
  appId: "1:227124134203:web:2f7a0c968cbb33dc88b71e",
  measurementId: "G-B3G1GXLMS9"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==========================================================================
// CLASSES PRINCIPAIS (PROGRAMAÇÃO ORIENTADA A OBJETOS)
// ==========================================================================

class Usuario {
    constructor(nome, contato) {
        if (this.constructor === Usuario) {
            throw new Error("Classe abstrata 'Usuario' não pode ser instanciada diretamente.");
        }
        this.nome = nome;
        this.contato = contato;
    }
}

class Doador extends Usuario {
    constructor(nome, contato, alimento) {
        super(nome, contato);
        this.alimento = alimento;
        this.dataCadastro = new Date().toISOString();
    }
}

class Solicitante extends Usuario {
    constructor(nome, contato, necesidad) {
        super(nome, contato);
        this.necessidade = necesidad;
        this.dataCadastro = new Date().toISOString();
    }
}

class Doacao {
    constructor(doador, item) {
        this.id = 'DOC_' + Math.random().toString(36).substr(2, 9);
        this.doador = doador;
        this.item = item;
        this.dataCriacao = new Date().toISOString();
    }
}

// ==========================================================================
// ESTRUTURA DE DADOS: FILA (FIRST-IN, FIRST-OUT)
// ==========================================================================
class Fila {
    constructor() {
        this.itens = JSON.parse(localStorage.getItem('ecofila_queue')) || [];
    }

    enqueue(solicitante) {
        this.itens.push(solicitante);
        this.salvarLocalStorage();
    }

    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        const removido = this.itens.shift();
        this.salvarLocalStorage();
        return removido;
    }

    peek() {
        return this.isEmpty() ? null : this.itens[0];
    }

    isEmpty() {
        return this.itens.length === 0;
    }

    size() {
        return this.itens.length;
    }

    getAll() {
        return this.itens;
    }

    setAll(novosItens) {
        this.itens = novosItens;
        this.salvarLocalStorage();
    }

    salvarLocalStorage() {
        localStorage.setItem('ecofila_queue', JSON.stringify(this.itens));
    }
}

const filaAgendados = new Fila();

// ==========================================================================
// INTERFACE E MANIPULAÇÃO DO DOM (UI) + INTEGRAÇÃO FIREBASE
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    const formDoador = document.getElementById('formDoador');
    const formSolicitante = document.getElementById('formSolicitante');
    const queueView = document.getElementById('queueView');
    const btnAtender = document.getElementById('btnAtender');
    const nextName = document.getElementById('nextName');
    const nextItem = document.getElementById('nextItem');
    const painelDoadores = document.getElementById('painelDoadores');

    /* ==========================================================================
       LÓGICA DA PÁGINA: CADASTRO.HTML (COM ADIÇÃO DO BANCO DE DADOS)
       ========================================================================== */
    if (formDoador) {
        formDoador.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('nomeDoador').value;
            const contato = document.getElementById('contatoDoador').value;
            const alimento = document.getElementById('alimento').value;

            const novoDoador = new Doador(nome, contato, alimento);
            const novaDoacao = new Doacao(novoDoador.nome, novoDoador.alimento);

            let doacoesDisponiveis = JSON.parse(localStorage.getItem('ecofila_donations')) || [];
            doacoesDisponiveis.push(novaDoacao);
            localStorage.setItem('ecofila_donations', JSON.stringify(doacoesDisponiveis));

            database.ref('doadores').push({
                empresa: novoDoador.nome,
                contato: novoDoador.contato,
                itemDoado: novoDoador.alimento,
                tipo: "Pessoa Jurídica (Doador)",
                dataCadastro: novoDoador.dataCadastro
            })
            .then(() => {
                showToast(`Obrigado ${novoDoador.nome}! Doação registrada no banco de dados.`, 'success');
                formDoador.reset();
            })
            .catch((error) => {
                console.error("Erro ao salvar no banco de dados:", error);
                showToast("Erro ao processar envio para a nuvem.", "error");
            });
        });
    }

    if (formSolicitante) {
        formSolicitante.addEventListener('submit', (e) => {
            e.preventDefault();

            const nome = document.getElementById('nomeSolicitante').value;
            const contato = document.getElementById('contatoSolicitante').value;
            const necesidad = document.getElementById('necessidade').value;

            const novoSolicitante = new Solicitante(nome, contato, necesidad);

            // 1. Enviamos direto para o nó centralizador do Firebase. 
            database.ref('solicitantes').push({
                nome: novoSolicitante.nome,
                contato: novoSolicitante.contato,
                necessidade: novoSolicitante.necessidade,
                tipo: "Pessoa Física (Solicitante)",
                dataCadastro: novoSolicitante.dataCadastro
            })
            .then(() => {
                showToast("Solicitante adicionado à fila e salvo na nuvem!", 'success');
                formSolicitante.reset();
            })
            .catch((error) => {
                console.error("Erro ao salvar solicitante no banco:", error);
                showToast("Erro ao salvar solicitante na nuvem.", "error");
            });
        });
    }

    /* ==========================================================================
       LÓGICA DA PÁGINA: FILA.HTML (ATENDIMENTO DE SOLICITANTES - CORRIGIDO EM TEMPO REAL)
       ========================================================================== */
    function renderizarPainelFila() {
        if (!queueView) return;

        database.ref('solicitantes').on('value', (snapshot) => {
            queueView.innerHTML = '';
            const listaTemporaria = [];

            if (!snapshot.exists()) {
                filaAgendados.setAll([]);
                queueView.innerHTML = `
                    <div class="empty-state">
                        <p>Nenhuma solicitação no momento.</p>
                    </div>
                `;
                if (nextName) nextName.innerText = "Ninguém na fila";
                if (nextItem) nextItem.innerText = "";
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const dados = childSnapshot.val();
                listaTemporaria.push({
                    key: childSnapshot.key,
                    nome: dados.nome,
                    contato: dados.contato,
                    necessidade: dados.necessidade
                });
            });
          
            filaAgendados.setAll(listaTemporaria);

            const todos = filaAgendados.getAll();
            todos.forEach((solicitante, index) => {
                const itemHTML = document.createElement('div');
                itemHTML.className = 'queue-item';
                itemHTML.innerHTML = `
                    <div>
                        <strong>${solicitante.nome}</strong> 
                        <br><small style="color:var(--text-muted)">Necessidade: ${solicitante.necessidade}</small>
                    </div>
                    <div>
                        <span class="badge badge-item">${solicitante.contato}</span>
                        <span class="badge badge-position">${index + 1}º Lugar</span>
                    </div>
                `;
                queueView.appendChild(itemHTML);
            });

            const proximo = filaAgendados.peek();
            if (proximo && nextName && nextItem) {
                nextName.innerText = proximo.nome;
                nextItem.style.color = "#FFFFFF"; 
                nextItem.innerText = `Precisa de: ${proximo.necessidade}`;
            }
        });
    }

    if (btnAtender) {
        btnAtender.addEventListener('click', () => {
            if (filaAgendados.isEmpty()) {
                showToast("Operação Inválida: A fila já está vazia!", 'error');
                return;
            }

            const proximoAtendimento = filaAgendados.peek();

            if (proximoAtendimento && proximoAtendimento.key) {
                database.ref(`solicitantes/${proximoAtendimento.key}`).remove()
                .then(() => {
                    showToast(`Sucesso! ${proximoAtendimento.nome} foi atendido e removido do sistema.`, 'success');
                })
                .catch((error) => {
                    console.error("Erro ao remover solicitante do banco:", error);
                    showToast("Erro ao registrar atendimento na nuvem.", "error");
                });
            }
        });
    }

    /* ==========================================================================
       NOVA LÓGICA: RENDERIZAR PAINEL DE EMPRESAS PARCEIRAS (FIREBASE)
       ========================================================================== */
    function renderizarPainelDoadores() {
        if (!painelDoadores) return;

        database.ref('doadores').on('value', (snapshot) => {
            painelDoadores.innerHTML = ''; 

            if (!snapshot.exists()) {
                painelDoadores.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; text-align: center; width: 100%;">
                        <p>Nenhum lote de alimento doado no momento.</p>
                    </div>
                `;
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const dadosEmpresa = childSnapshot.val();

                const cardHTML = document.createElement('div');
                cardHTML.className = 'queue-item';
                cardHTML.style.borderLeft = '4px solid #2ecc71'; 
                cardHTML.innerHTML = `
                    <div>
                        <strong>🏢 ${dadosEmpresa.empresa}</strong> 
                        <br><small style="color:var(--text-muted)">Disponibilizou: ${dadosEmpresa.itemDoado}</small>
                    </div>
                    <div>
                        <span class="badge badge-item">${dadosEmpresa.contato}</span>
                    </div>
                `;
                painelDoadores.appendChild(cardHTML);
            });
        });
    }

    if (queueView) {
        renderizarPainelFila();
    }
    if (painelDoadores) {
        renderizarPainelDoadores();
    }
});

/*
  COMPONENTE VISUAL: Feedback dinâmico (Toast)
*/
function showToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerText = mensaje || mensagem; 
    toast.className = `show ${tipo}`;
    
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 4000);
}
