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
let velocidadeSimulacao = 1; // 1x, 2x, 3x, etc.

// --- Configuração do Gráfico Curva S ---
let curvaSChart;

// === FUNÇÕES DE UTILIDADE ===
function formatarValor(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function varColor(name) {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(`--cor-${name}`).trim();
}

// Mapeamento de valores do slider (1-7) para a velocidade de execução
const mapeamentoVelocidade = {
    '1': 0.25, // Muito Lento
    '2': 0.5,  // Lento
    '3': 1,    // Normal (1x)
    '4': 2,    // Rápido (2x)
    '5': 3,    // 3x
    '6': 4,    // 4x
    '7': 5     // Muito Rápido (5x)
};

// === LÓGICA DO PROJETO ===

// 1. Carrega os dados e inicializa
async function inicializarProjeto() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        projetoData = data.fases;
        CUSTO_TOTAL_PREVISTO = data.custo_total_previsto;
        
        document.getElementById('velocidade-atual').textContent = 'Velocidade: 1x';
        
        // NOVO: Renderiza os blocos da simulação 3D (para dar feedback visual)
        renderizarBlocosSimulacao();

        inicializarGrafico();
        atualizarKPIs();
        atualizarDetalhesAtividade(projetoData[faseAtualIndex]); 
        document.getElementById('fase-atual').textContent = `Fase: ${projetoData[faseAtualIndex].nome}`;

    } catch (error) {
        console.error("Erro ao carregar data.json:", error);
        alert("Erro ao carregar dados do projeto. Verifique o arquivo data.json.");
    }
}

// FUNÇÃO NOVA: Adiciona os blocos da simulação 3D no HTML
function renderizarBlocosSimulacao() {
    const predioSimulado = document.querySelector('.predio-simulado');
    predioSimulado.innerHTML = ''; // Limpa qualquer conteúdo anterior

    // Percorre as fases de construção (0 a 7) e cria um bloco para cada
    projetoData.forEach((fase, index) => {
        const andar = document.createElement('div');
        andar.classList.add('andar');
        andar.id = `andar-${index}`;
        andar.textContent = `${fase.nome}`;
        
        // A fundação começa com um status visual um pouco diferente (mais escura)
        if (index === 0) {
             andar.style.backgroundColor = 'rgba(50, 50, 50, 0.8)';
        }

        predioSimulado.appendChild(andar);
    });
}

// 2. Configura o Gráfico Chart.js
function inicializarGrafico() {
    const ctx = document.getElementById('curva-s-chart').getContext('2d');
    const labels = ['Início'];
    
    projetoData.forEach((item, index) => labels.push(`Fase ${item.id}`));

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
        pararSimulacao();
        return;
    }

    const fatorProdutividade = (0.9 + Math.random() * 0.2);
    const desvioCusto = 1.0 + (Math.random() - 0.5) * 0.02; 

    // O avanço é proporcional à velocidade escolhida
    const avanco = 1.0 * fatorProdutividade * velocidadeSimulacao;
    progressoFase += avanco;

    const custoAvancado = (faseAtual.custo_previsto / 100) * avanco * desvioCusto;
    custoAcumulado += custoAvancado;

    // 4. Atualização de Fases
    if (progressoFase >= 100) {
        progressoFase = 100;

        progressoGeral += faseAtual.peso_percentual;
        
        // Simulação 3D: Marca a fase como concluída
        const andarElement = document.getElementById(`andar-${faseAtualIndex}`);
        if (andarElement) {
            andarElement.classList.add('concluido'); // Adiciona a classe de concluído do CSS
            andarElement.textContent = `Fase ${faseAtual.id} - CONCLUÍDO`;
        }

        faseAtualIndex++;
        progressoFase = 0;
        
        if (faseAtualIndex < projetoData.length) {
            atualizarDetalhesAtividade(projetoData[faseAtualIndex]); 
        }
    } else {
        const pesoFasesAnteriores = projetoData.slice(0, faseAtualIndex).reduce((acc, item) => acc + item.peso_percentual, 0);
        progressoGeral = pesoFasesAnteriores + (progressoFase / 100) * faseAtual.peso_percentual;
    }

    atualizarKPIs();
}

// 5. Atualiza o Painel KPI
function atualizarKPIs() {
    
    // -- Variáveis Chave EVM (Earned Value Management) --
    const valorAgregado = (progressoGeral / PESO_TOTAL) * CUSTO_TOTAL_PREVISTO; // EV
    const valorPlanejadoFase = projetoData[faseAtualIndex] ? (projetoData[faseAtualIndex].custo_previsto / 100) * progressoFase : 0;
    const valorPlanejadoAcumulado = projetoData.slice(0, faseAtualIndex).reduce((acc, item) => acc + item.custo_previsto, 0) + valorPlanejadoFase; // PV

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
    const SPI = valorAgregado / valorPlanejadoAcumulado;

    if (SPI < 0.9 && progressoGeral < 95) { 
        kpiPrevisao.textContent = 'RISCO ALTO';
        statusPrevisao.textContent = `Atraso Estimado (+${(365 * (1/SPI - 1)).toFixed(0)} dias)`;
        statusPrevisao.className = 'status-badge status-risco';
    } else if (SPI < 0.95 && progressoGeral < 95) {
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
    
    atualizarCurvaS(custoAcumulado);
}

// Função para popular a lista de atividades detalhadas
function atualizarDetalhesAtividade(fase) {
    const listaUl = document.getElementById('lista-atividades-fase');
    listaUl.innerHTML = ''; // Limpa a lista anterior

    document.getElementById('detalhe-atividade').textContent = fase.nome;
    
    fase.atividades_detalhadas.forEach(atividade => {
        const li = document.createElement('li');
        li.textContent = atividade;
        listaUl.appendChild(li);
    });

    document.getElementById('detalhe-recurso').textContent = fase.recursos_chave.join(', ');
    document.getElementById('detalhe-fornecedor').textContent = fase.fornecedor_chave;
}

function atualizarCurvaS(custoRealizado) {
    const dataRealizado = curvaSChart.data.datasets[1].data;
    
    if (faseAtualIndex + 1 > dataRealizado.length) {
        dataRealizado.push(custoRealizado); 
    } else if (faseAtualIndex < projetoData.length) {
        dataRealizado[faseAtualIndex] = custoRealizado;
    }
    
    curvaSChart.update();
}

// === FUNÇÕES DE CONTROLE (BOTÕES) ===
function iniciarSimulacao() {
    if (simulacaoInterval) {
        clearInterval(simulacaoInterval);
    }
    const velocidadeLabel = document.getElementById('velocidade-atual').textContent.replace('Velocidade: ', '');
    document.getElementById('btn-simular').textContent = `⏸️ Pausar Simulação (${velocidadeLabel})`;
    document.getElementById('btn-simular').classList.remove('botao-primario');
    
    simulacaoInterval = setInterval(atualizarSimulacao, 100); 
}

function pararSimulacao() {
    clearInterval(simulacaoInterval);
    simulacaoInterval = null;
    const velocidadeLabel = document.getElementById('velocidade-atual').textContent.replace('Velocidade: ', '');
    document.getElementById('btn-simular').textContent = `▶️ Continuar Simulação (${velocidadeLabel})`;
    document.getElementById('btn-simular').classList.add('botao-primario');
}

function alternarSimulacao() {
    if (simulacaoInterval) {
        pararSimulacao();
    } else {
        iniciarSimulacao();
    }
}

function mudarVelocidade(sliderValue) {
    velocidadeSimulacao = mapeamentoVelocidade[sliderValue];
    document.getElementById('velocidade-atual').textContent = `Velocidade: ${velocidadeSimulacao}x`;
    if (simulacaoInterval) {
        iniciarSimulacao();
    } else {
         document.getElementById('btn-simular').textContent = `▶️ Iniciar Simulação (${velocidadeSimulacao}X)`;
    }
}

// === FUNÇÕES DE DEMONSTRAÇÃO (ALERTAS) ===
function ativarAnalisePreditiva() {
    alert('🧠 Análise Preditiva de IA em ação! O sistema está monitorando a produtividade em tempo real para calcular o SPI (Índice de Desempenho do Cronograma) e estimar o risco de atraso.');
}

function visualizarLogistica() {
    alert('🚚 Logística JIT/Fornecedores: O painel de Detalhes da Atividade mostra o recurso-chave e o fornecedor da fase atual, simulando o monitoramento de rastreamento de entrega.');
}

function modoRaioX() {
    alert('🔭 Modo Raio-X Ativado: Demonstração de integração BIM! (No modelo 3D real, as paredes seriam transparentes para visualizar tubos e fiações).');
}

function mostrarConflitos() {
    alert('⚠️ Alerta de Conflito: O modelo BIM identificou uma colisão (clash detection) entre o duto de ventilação e uma tubulação elétrica no 4º andar. A equipe é notificada para correção imediata no projeto.');
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', inicializarProjeto);