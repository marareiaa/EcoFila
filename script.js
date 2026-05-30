 /* ==========================================================================
 CLASSES PRINCIPAIS
 ========================================================================== */

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
    constructor(nome, contato, necessidade) {
        super(nome, contato);
        this.necessidade = necessidade;
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

/*
 ESTRUTURA DE DADOS: FILA (FIRST-IN, FIRST-OUT)
 */
class Fila {
    constructor() {
        // Busca dados já salvos ou inicia vazia
        this.itens = JSON.parse(localStorage.getItem('ecofila_queue')) || [];
    }

    // Adiciona na fila (No final)
    enqueue(solicitante) {
        this.itens.push(solicitante);
        this.salvarLocalStorage();
    }

    // Remove da fila (O primeiro que entrou)
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        const removido = this.itens.shift();
        this.salvarLocalStorage();
        return removido;
    }

    // Olhar quem é o próximo sem remover
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

    salvarLocalStorage() {
        localStorage.setItem('ecofila_queue', JSON.stringify(this.itens));
    }
}

// Inicializador da Fila Global
const filaAgendados = new Fila();

/*
 INTERFACE E MANIPULAÇÃO DO DOM (UI)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Captura de Elementos das Páginas
    const formDoador = document.getElementById('formDoador');
    const formSolicitante = document.getElementById('formSolicitante');
    const queueView = document.getElementById('queueView');
    const btnAtender = document.getElementById('btnAtender');
    const nextName = document.getElementById('nextName');
    const nextItem = document.getElementById('nextItem');

    /* =========================================
       LÓGICA DA PÁGINA: CADASTRO.HTML
       ========================================= */
    if (formDoador) {
        formDoador.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('nomeDoador').value;
            const contato = document.getElementById('contatoDoador').value;
            const alimento = document.getElementById('alimento').value;

            // Instanciação via POO
            const novoDoador = new Doador(nome, contato, alimento);
            const novaDoacao = new Doacao(novoDoador.nome, novoDoador.alimento);

            // Armazenamento de Histórico de Doações Disponíveis
            let doacoesDisponiveis = JSON.parse(localStorage.getItem('ecofila_donations')) || [];
            doacoesDisponiveis.push(novaDoacao);
            localStorage.setItem('ecofila_donations', JSON.stringify(doacoesDisponiveis));

            showToast(`Obrigado ${novoDoador.nome}! Doação registrada com sucesso.`, 'success');
            formDoador.reset();
        });
    }

    if (formSolicitante) {
        formSolicitante.addEventListener('submit', (e) => {
            e.preventDefault();

            const nome = document.getElementById('nomeSolicitante').value;
            const contato = document.getElementById('contatoSolicitante').value;
            const necessidade = document.getElementById('necessidade').value;

            // Instanciação via POO
            const novoSolicitante = new Solicitante(nome, contato, necessidade);

            // Enfileirando usando a Estrutura de Dados
            filaAgendados.enqueue(novoSolicitante);

            showToast("Solicitante adicionado à fila com sucesso!", 'success');
            formSolicitante.reset();
        });
    }

    /* =========================================
       LÓGICA DA PÁGINA: FILA.HTML
       ========================================= */
    function renderizarPainelFila() {
        if (!queueView) return;

        const todos = filaAgendados.getAll();
        queueView.innerHTML = '';

        if (todos.length === 0) {
            queueView.innerHTML = `
                <div class="empty-state">
                    <p>Nenhuma solicitação no momento.</p>
                </div>
            `;
            if(nextItem) nextItem.innerText = "";
            return;
        }

        // Renderiza a lista completa
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

        // Configura o Painel lateral do Próximo (Peek)
    const proximo = filaAgendados.peek();
    if (proximo && nextName && nextItem) {
        nextName.innerText = proximo.nome;
        // Usamos innerHTML com um span estilizado em branco para o rótulo
        nextItem.innerHTML = `<span style="color: #FFFFFF;">Precisa de:</span> ${proximo.necessidade}`;
    }
}
    // Evento do botão Atender (Dequeue)
    if (btnAtender) {
        btnAtender.addEventListener('click', () => {
            if (filaAgendados.isEmpty()) {
                showToast("Operação Inválida: A fila já está vazia!", 'error');
                return;
            }

            // Remove o elemento com base no FIFO
            const atendido = filaAgendados.dequeue();
            showToast(`Sucesso! ${atendido.nome} foi atendido.`, 'success');
            
            // Atualiza o monitor gráfico
            renderizarPainelFila();
        });
    }

    // Inicialização da View, caso esteja na página da fila
    if (queueView) {
        renderizarPainelFila();
    }
});

/*
 COMPONENTE VISUAL: Feedback dinâmico (Toast)
 */
function showToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerText = mensagem;
    toast.className = `show ${tipo}`;
    
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 4000);
}
