// Arquivo: simulacao.js

// === ESTADO DA SIMULAÇÃO GLOBAL ===
let projetoData;
let CUSTO_TOTAL_PREVISTO;
let PESO_TOTAL = 100;

let progressoGeral = 0; // % total
let custoAcumulado = 0; // R$
let faseAtualIndex = 0; // Índice do array de fases (começa em 0)
let progressoFase = 0; // % dentro da fase
let simulacaoInterval;
let velocidadeSimulacao = 1;

// --- Configuração do Gráfico Curva S ---
let curvaSChart;

// === FUNÇÕES DE UTILIDADE ===
function formatarValor(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function varColor(name) {
    const root = document.documentElement;
    // Pega as variáveis definidas no CSS
    return getComputedStyle(root).getPropertyValue(`--cor-${name}`).trim();
}

// === LÓGICA DO PROJETO ===

// 1. Carrega os dados e inicializa
async function inicializarProjeto() {
    try {
        // Simula o carregamento do data.json
        const response = await fetch('data.json');
        const data = await response.json();
        
        projetoData = data.fases;
        CUSTO_TOTAL_PREVISTO = data.custo_total_previsto;
        
        // Inicializa o Chart.js
        inicializarGrafico();
        
        // Define o estado inicial dos KPIs
        atualizarKPIs();
        document.getElementById('fase-atual').textContent = `Fase: ${projetoData[faseAtualIndex].nome}`;

    } catch (error) {
        console.error("Erro ao carregar data.json:", error);
        alert("Erro ao carregar dados do projeto. Verifique o arquivo data.json.");
    }
}

// 2. Configura o Gráfico Chart.js
function inicializarGrafico() {
    const ctx = document.getElementById('curva-s-chart').getContext('2d');
    const labels = ['Início'];
    
    // Cria labels para o gráfico baseado nas fases
    projetoData.forEach((item, index) => labels.push(`Fase ${item.id}`));

    // Calcula a Curva S Prevista (Acumulado)
    const dataPrevista = [0];
    let tempPrevisto = 0;
    projetoData.forEach(item => {
        tempPrevisto += item.custo_previsto;
        dataPrevista.push(tempPrevisto);
    });

    curvaSChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Previsto',
                    data: dataPrevista,
                    borderColor: varColor('senai'),
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3
                },
                {
                    label: 'Realizado',
                    data: [0],
                    borderColor: varColor('risco'),
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (value) => `R$ ${formatarValor(value / 1000000)}M` }
                }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}


// 3. O Motor da Simulação
function atualizarSimulacao() {
    const faseAtual = projetoData[faseAtualIndex];
    if (!faseAtual) {
        // Simulação completa
        pararSimulacao();
        return;
    }

    // Fatores de IA/Riscos: Simulação de produtividade e desvio de custo
    const fatorProdutividade = (0.9 + Math.random() * 0.2) * (velocidadeSimulacao / 2); // Varia 0.9 a 1.1 base
    const desvioCusto = 1.0 + (Math.random() - 0.5) * 0.02; // Variação de -1% a +1% no custo

    // 1. Avanço
    const avanco = 1.0 * fatorProdutividade; // Avança 1% por tick base (ajustado pela velocidade)
    progressoFase += avanco;

    // 2. Custos
    const custoAvancado = (faseAtual.custo_previsto / 100) * avanco * desvioCusto;
    custoAcumulado += custoAvancado;

    // 3. Atualização de Fases
    if (progressoFase >= 100) {
        progressoFase = 100;

        // Atualiza Progresso Total pelo Peso da Fase
        progressoGeral += faseAtual.peso_percentual;
        
        // Animação de conclusão no Mockup 3D
        const andarElement = document.getElementById(`andar-${faseAtualIndex}`);
        if (andarElement) {
            andarElement.style.backgroundColor = varColor('concluido');
            andarElement.style.color = 'white';
            andarElement.textContent = `Fase ${faseAtual.id} - CONCLUÍDO`;
        }

        // Avança para a próxima fase
        faseAtualIndex++;
        progressoFase = 0; // Reinicia o progresso da nova fase
    } else {
        // Calcula Progresso Total Parcial
        const pesoFasesAnteriores = projetoData.slice(0, faseAtualIndex).reduce((acc, item) => acc + item.peso_percentual, 0);
        progressoGeral = pesoFasesAnteriores + (progressoFase / 100) * faseAtual.peso_percentual;
    }

    atualizarKPIs(desvioCusto, fatorProdutividade);
}

// 4. Atualiza o Painel KPI e Gráfico
function atualizarKPIs(desvioCusto = 1, fatorProdutividade = 1) {
    
    // -- Variáveis Chave EVM (Earned Value Management) --
    const valorAgregado = (progressoGeral / PESO_TOTAL) * CUSTO_TOTAL_PREVISTO; // EV
    const valorPlanejadoAcumulado = projetoData.slice(0, faseAtualIndex + 1).reduce((acc, item) => acc + item.custo_previsto, 0) * (progressoFase / 100); 

    const variacaoCusto = custoAcumulado - valorAgregado; // CV = EV - AC
    const percentualVariacao = (variacaoCusto / valorAgregado) * 100 || 0;
    
    // -- KPI 1: Andamento Físico --
    document.getElementById('kpi-andamento').textContent = `${progressoGeral.toFixed(1)}%`;
    
    if (faseAtualIndex < projetoData.length) {
        document.getElementById('fase-atual').textContent = `Fase: ${projetoData[faseAtualIndex].nome} (${progressoFase.toFixed(0)}%)`;
    } else {
        document.getElementById('fase-atual').textContent = `Projeto CONCLUÍDO!`;
    }

    // -- KPI 2: Variação de Custo --
    const sinal = percentualVariacao > 0 ? '+' : '';
    document.getElementById('kpi-custo').textContent = `${formatarValor(custoAcumulado)} (${sinal}${percentualVariacao.toFixed(1)}%)`;
    
    const custoStatus = document.getElementById('status-custo');
    if (percentualVariacao < -5) {
        custoStatus.textContent = 'Alto Desvio Negativo';
        custoStatus.className = 'status-badge status-risco';
    } else if (percentualVariacao < 0) {
        custoStatus.textContent = 'Baixo Desvio';
        custoStatus.className = 'status-badge status-alerta';
    } else {
        custoStatus.textContent = 'Orçamento OK';
        custoStatus.className = 'status-badge status-sucesso';
    }
    
    // -- KPI 3: Previsão IA (Risco) --
    const statusPrevisao = document.getElementById('status-previsao');
    const kpiPrevisao = document.getElementById('kpi-previsao');
    const SPI = valorAgregado / valorPlanejadoAcumulado; // SPI = EV / PV

    if (SPI < 0.9) { // Queda de desempenho no cronograma
        kpiPrevisao.textContent = 'RISCO ALTO';
        statusPrevisao.textContent = `Atraso Estimado (+${(1/SPI * 365).toFixed(0)} dias)`;
        statusPrevisao.className = 'status-badge status-risco';
    } else if (SPI < 0.95) {
        kpiPrevisao.textContent = 'Risco Médio';
        statusPrevisao.textContent = 'Atenção ao Cronograma';
        statusPrevisao.className = 'status-badge status-alerta';
    } else {
        kpiPrevisao.textContent = 'Risco Baixo';
        statusPrevisao.textContent = 'Conclusão no Prazo';
        statusPrevisao.className = 'status-badge status-sucesso';
    }

    // -- KPI 4: Utilização de Equipamentos (IoT Virtual) --
    const utilizacao = Math.min(100, 40 + (progressoGeral / 100 * 50) + (Math.random() * 20));
    document.getElementById('kpi-equipamento').textContent = `${utilizacao.toFixed(0)}%`;
    const statusEquipamento = document.getElementById('status-equipamento');
    if (utilizacao < 35 && progressoGeral > 20) {
        statusEquipamento.textContent = 'Subutilizada (Custos Ociosos)';
        statusEquipamento.className = 'status-badge status-alerta';
    } else {
        statusEquipamento.textContent = 'Otimizada';
        statusEquipamento.className = 'status-badge status-sucesso';
    }

    // -- Curva S --
    atualizarCurvaS(custoAcumulado);
}

function atualizarCurvaS(custoRealizado) {
    const dataRealizado = curvaSChart.data.datasets[1].data;
    
    // Se a fase mudou, adiciona um novo ponto no gráfico
    if (faseAtualIndex + 1 > dataRealizado.length) {
         // O novo ponto de custo realizado é o custo atual acumulado
        dataRealizado.push(custoRealizado); 
    } else if (faseAtualIndex < projetoData.length) {
        // Atualiza o último ponto (a fase atual)
        dataRealizado[faseAtualIndex] = custoRealizado;
    }
    
    curvaSChart.update();
}

// === FUNÇÕES DE CONTROLE (BOTÕES) ===
function iniciarSimulacao() {
    if (simulacaoInterval) {
        clearInterval(simulacaoInterval);
    }
    document.getElementById('btn-simular').textContent = `⏸️ Pausar Simulação (${velocidadeSimulacao}X)`;
    document.getElementById('btn-simular').classList.remove('botao-primario');
    simulacaoInterval = setInterval(atualizarSimulacao, 100); // Roda mais rápido para simular fluidez
}

function pararSimulacao() {
    clearInterval(simulacaoInterval);
    simulacaoInterval = null;
    document.getElementById('btn-simular').textContent = `▶️ Continuar Simulação (${velocidadeSimulacao}X)`;
    document.getElementById('btn-simular').classList.add('botao-primario');
}

function alternarSimulacao() {
    if (simulacaoInterval) {
        pararSimulacao();
    } else {
        iniciarSimulacao();
    }
}

function mudarVelocidade(novaVelocidade) {
    velocidadeSimulacao = parseInt(novaVelocidade);
    document.getElementById('velocidade-atual').textContent = `Velocidade: ${velocidadeSimulacao}x`;
    if (simulacaoInterval) {
        iniciarSimulacao(); // Reinicia o intervalo com a nova velocidade
    } else {
         document.getElementById('btn-simular').textContent = `▶️ Iniciar Simulação (${velocidadeSimulacao}X)`;
    }
}

// === FUNÇÕES DE DEMONSTRAÇÃO (ALERTAS) ===
function ativarAnalisePreditiva() {
    alert('🧠 Análise Preditiva de IA em ação! O sistema está monitorando a produtividade em tempo real para calcular o SPI (Índice de Desempenho do Cronograma) e estimar o risco de atraso.');
}

function visualizarLogistica() {
    alert('🚚 Logística JIT/Fornecedores: Os dados do JSON mostram que o fornecedor chave da próxima fase é "Cerâmica Norte". O sistema alerta se o prazo de entrega afetar o cronograma principal.');
}

function modoRaioX() {
    alert('🔭 Modo Raio-X Ativado: Demonstração de integração BIM! (No 3D real, as paredes seriam transparentes para visualizar tubos e fiações).');
}

function mostrarConflitos() {
    alert('⚠️ Alerta de Conflito: O modelo BIM identificou uma colisão (clash detection) entre o duto de ventilação e uma tubulação elétrica no 4º andar. A equipe é notificada para correção imediata no projeto.');
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', inicializarProjeto);