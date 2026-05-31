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

// 🔐 CONFIGURAÇÕES DE REGRAS DE NEGÓCIO
const ADMIN_PASSWORD = "131072"; 
const LIMITE_DOACOES_POR_DOADOR = 1;    
const LIMITE_PEDIDOS_POR_RECEPTOR = 1;  
const ITENS_INICIAIS_FILA = 3;         

let expandido = false;

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
        this.dataCadastro = new Date().toLocaleString('pt-BR');
    }
}

class Solicitante extends Usuario {
    constructor(nome, contato, necesidad) {
        super(nome, contato);
        this.necessidade = necesidad;
        this.dataCadastro = new Date().toLocaleString('pt-BR');
    }
}

class Doacao {
    constructor(doador, item) {
        this.id = 'DOC_' + Math.random().toString(36).substr(2, 9);
        this.doador = doador;
        this.item = item;
        this.dataCriacao = new Date().toLocaleString('pt-BR');
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
        if (this.isEmpty()) return null;
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
// FUNÇÕES DE VALIDAÇÃO RÍGIDA
// ==========================================================================

function obterTelefoneValido(telefone) {
    const apenasNumeros = telefone.replace(/\D/g, '');
    if (apenasNumeros.length === 10 || apenasNumeros.length === 11) {
        return apenasNumeros; 
    }
    return null; 
}

function formatarTelefone(numString) {
    if (numString.length === 11) {
        return `(${numString.substring(0,2)}) ${numString.substring(2,7)}-${numString.substring(7)}`;
    } else if (numString.length === 10) {
        return `(${numString.substring(0,2)}) ${numString.substring(2,6)}-${numString.substring(6)}`;
    }
    return numString;
}

// ==========================================================================
// INTERFACE E INTEGRAÇÃO FIREBASE
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
       LÓGICA: CADASTRO DE DOADORES
       ========================================================================== */
    if (formDoador) {
        formDoador.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nome = document.getElementById('nomeDoador').value.trim();
            const contatoRaw = document.getElementById('contatoDoador').value.trim();
            const alimento = document.getElementById('alimento').value.trim();

            const contatoLimpo = obterTelefoneValido(contatoRaw);
            if (!contatoLimpo) {
                showToast("Erro: Digite um telefone válido com DDD. Ex: (11) 99999-9999", "error");
                return; 
            }

            const contatoFormatado = formatarTelefone(contatoLimpo);

            database.ref('doadores').once('value', (snapshot) => {
                let doacoesAtivas = 0;

                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                        const doadorBanco = childSnapshot.val();
                        const telefoneBancoLimpo = doadorBanco.contato.replace(/\D/g, '');
                        if (telefoneBancoLimpo === contatoLimpo) doacoesAtivas++;
                    });
                }

                if (doacoesAtivas >= LIMITE_DOACOES_POR_DOADOR) {
                    showToast(`Limite excedido! Este doador já possui ${LIMITE_DOACOES_POR_DOADOR} lotes ativos no sistema.`, 'error');
                    return; 
                }

                const novoDoador = new Doador(nome, contatoFormatado, alimento);
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
                    showToast(`Sucesso! O lote de "${novoDoador.alimento}" foi disponibilizado. Obrigado, ${novoDoador.nome}!`, 'success');
                    formDoador.reset();
                })
                .catch((error) => {
                    console.error(error);
                    showToast("Erro ao processar envio para a nuvem.", "error");
                });
            });
        });
    }

    /* ==========================================================================
       LÓGICA: CADASTRO DE SOLICITANTES
       ========================================================================== */
    if (formSolicitante) {
        formSolicitante.addEventListener('submit', (e) => {
            e.preventDefault();

            const nome = document.getElementById('nomeSolicitante').value.trim();
            const contatoRaw = document.getElementById('contatoSolicitante').value.trim();
            const necesidad = document.getElementById('necessidade').value.trim();

            const contatoLimpo = obterTelefoneValido(contatoRaw);
            if (!contatoLimpo) {
                showToast("Erro: Digite um telefone válido com DDD. Ex: (11) 98888-8888", "error");
                return; 
            }

            const contatoFormatado = formatarTelefone(contatoLimpo);

            database.ref('solicitantes').once('value', (snapshot) => {
                let pedidosAtivos = 0;

                if (snapshot.exists()) {
                    snapshot.forEach((childSnapshot) => {
                        const solicitanteBanco = childSnapshot.val();
                        const telefoneBancoLimpo = solicitanteBanco.contato.replace(/\D/g, '');
                        if (telefoneBancoLimpo === contatoLimpo) pedidosAtivos++;
                    });
                }

                if (pedidosAtivos >= LIMITE_PEDIDOS_POR_RECEPTOR) {
                    showToast(`Acesso negado: Este número já possui ${LIMITE_PEDIDOS_POR_RECEPTOR} solicitação ativa na fila!`, 'error');
                    return; 
                }

                const novoSolicitante = new Solicitante(nome, contatoFormatado, necesidad);

                database.ref('solicitantes').push({
                    nome: novoSolicitante.nome,
                    contato: novoSolicitante.contato,
                    necessidade: novoSolicitante.necessidade,
                    tipo: "Pessoa Física (Solicitante)",
                    dataCadastro: novoSolicitante.dataCadastro
                })
                .then(() => {
                    showToast(`Sucesso! Você foi inserido na lista de espera cronológica.`, 'success');
                    formSolicitante.reset();
                })
                .catch((error) => {
                    console.error(error);
                    showToast("Erro ao salvar solicitante na nuvem.", "error");
                });
            });
        });
    }

    /* ==========================================================================
       LÓGICA: RENDERIZAR PAINEL FILA (COM SISTEMA "VER MAIS" REMOTO COERENTE)
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
                removerBotaoVerMais();
                return;
            }

            snapshot.forEach((childSnapshot) => {
                const dados = childSnapshot.val();
                listaTemporaria.push({
                    key: childSnapshot.key,
                    nome: dados.nome,
                    contato: dados.contato,
                    necessidade: dados.necessidade,
                    data: dados.dataCadastro || "Não informada"
                });
            });

            filaAgendados.setAll(listaTemporaria);
            const todos = filaAgendados.getAll();
          
            const itensParaMostrar = expandido ? todos : todos.slice(0, ITENS_INICIAIS_FILA);

            itensParaMostrar.forEach((solicitante, index) => {
                const itemHTML = document.createElement('div');
                itemHTML.className = 'queue-item';
                itemHTML.innerHTML = `
                    <div>
                        <strong>${solicitante.nome}</strong> 
                        <br><small style="color:var(--text-muted)">Necessidade: ${solicitante.necessidade}</small>
                        <br><small style="color: #95a5a6; font-size: 0.75rem;">Entrou em: ${solicitante.data}</small>
                    </div>
                    <div>
                        <span class="badge badge-item">${solicitante.contato}</span>
                        <span class="badge badge-position">${index + 1}º Lugar</span>
                    </div>
                `;
                queueView.appendChild(itemHTML);
            });

            if (todos.length > ITENS_INICIAIS_FILA) {
                criarOuAtualizarBotaoVerMais(todos.length - ITENS_INICIAIS_FILA);
            } else {
                removerBotaoVerMais();
            }

            const proximo = filaAgendados.peek();
            if (proximo && nextName && nextItem) {
                nextName.innerText = proximo.nome;
                nextItem.style.color = "#FFFFFF"; 
                nextItem.innerText = `Precisa de: ${proximo.necessidade}`;
            }
        });
    }

    function criarOuAtualizarBotaoVerMais(restantes) {
        let btnVerMais = document.getElementById('btnVerMaisFila');
        
        if (!btnVerMais) {
            btnVerMais = document.createElement('button');
            btnVerMais.id = 'btnVerMaisFila';

            btnVerMais.addEventListener('click', () => {
                expandido = !expandido;
                renderizarPainelFila(); 
            });
            
            queueView.parentNode.insertBefore(btnVerMais, queueView.nextSibling);
        }
        
        btnVerMais.innerText = expandido ? "▲ Mostrar Menos" : `▼ Ver Mais (+${restantes} pessoas na fila)`;
    }
    function removerBotaoVerMais() {
        const btnVerMais = document.getElementById('btnVerMaisFila');
        if (btnVerMais) btnVerMais.remove();
    }

    /* ==========================================================================
       LÓGICA: BOTÃO ATENDER
       ========================================================================== */
    if (btnAtender) {
        btnAtender.addEventListener('click', () => {
            if (filaAgendados.isEmpty()) {
                showToast("Operação Inválida: A fila já está vazia!", 'error');
                return;
            }

            const senhaDigitada = prompt("⚠️ Área Restrita!\nPor favor, digite a senha de Administrador para realizar o atendimento:");

            if (senhaDigitada === null) return; 

            if (senhaDigitada !== ADMIN_PASSWORD) {
                showToast("Senha incorreta! Acesso ao atendimento negado.", 'error');
                return; 
            }

            const proximoAtendimento = filaAgendados.peek();

            if (proximoAtendimento && proximoAtendimento.key) {
                database.ref(`solicitantes/${proximoAtendimento.key}`).remove()
                .then(() => {
                    showToast(`Sucesso! ${proximoAtendimento.nome} foi atendido e removido do sistema.`, 'success');
                })
                .catch((error) => {
                    console.error(error);
                    showToast("Erro ao registrar atendimento na nuvem.", "error");
                });
            }
        });
    }

    /* ==========================================================================
       LÓGICA: RENDERIZAR PAINEL DOADORES
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
                        <br><small style="color: #95a5a6; font-size: 0.75rem;">📅 Doado em: ${dadosEmpresa.dataCadastro || "Não informada"}</small>
                    </div>
                    <div>
                        <span class="badge badge-item">${dadosEmpresa.contato}</span>
                    </div>
                `;
                painelDoadores.appendChild(cardHTML);
            });
        });
    }

    if (queueView) renderizarPainelFila();
    if (painelDoadores) renderizarPainelDoadores();
});

function showToast(mensagem, tipo = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerText = mensagem;
    toast.className = `show ${tipo}`;
    
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 4500); 
}
