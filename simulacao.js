// Arquivo: simulacao.js

// === ESTADO DA SIMULAÇÃO GLOBAL ===
let projetoData;
let CUSTO_TOTAL_PREVISTO;
let PESO_TOTAL = 100;

let progressoGeral = 0; // % total do projeto
let custoAcumulado = 0; // R$ total acumulado (AC - Actual Cost)

let faseAtualIndex = 0; // Índice da fase atual
let progressoFase = 0; // % dentro da fase (0 a 100)

// NOVAS VARIÁVEIS PARA RASTREIO DETALHADO
let subAtividadeAtualIndex = 0; // Índice da sub-atividade dentro da fase atual
let progressoSubAtividade = 0;  // % de progresso da sub-atividade atual (0 a 100)
let custoSubAtividadeAcumulado = 0; // Custo REAL acumulado da sub-atividade

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
        
        renderizarBlocosSimulacao();
        inicializarGrafico();
        atualizarKPIs();
        
        // Verifica se há fases no projeto antes de tentar acessar o índice 0
        if (projetoData.length > 0) {
            atualizarDetalhesAtividade(projetoData[faseAtualIndex]); 
            document.getElementById('fase-atual').textContent = `Fase: ${projetoData[faseAtualIndex].nome}`;
        }

    } catch (error) {
        console.error("Erro ao carregar data.json:", error);
        alert("Erro ao carregar dados do projeto. Verifique o arquivo data.json.");
    }
}

// FUNÇÃO: Adiciona os blocos da simulação 3D no HTML
function renderizarBlocosSimulacao() {
    const predioSimulado = document.querySelector('.predio-simulado');
    predioSimulado.innerHTML = ''; 

    projetoData.forEach((fase, index) => {
        const andar = document.createElement('div');
        andar.classList.add('andar');
        andar.id = `andar-${index}`;
        andar.textContent = `${fase.nome}`;
        
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

    let subAtividadeAtual = faseAtual.atividades_detalhadas[subAtividadeAtualIndex];
    
    // TRATAMENTO DE TRANSIÇÃO DE FASE
    if (!subAtividadeAtual) {
        // Se todas as sub-atividades terminaram, avança para a próxima fase.
        progressoFase = 100;
        
        const andarElement = document.getElementById(`andar-${faseAtualIndex}`);
        if (andarElement) {
            andarElement.classList.add('concluido');
            andarElement.textContent = `Fase ${faseAtual.id} - CONCLUÍDO`;
        }
        
        faseAtualIndex++;
        subAtividadeAtualIndex = 0;
        progressoFase = 0;
        progressoSubAtividade = 0;
        custoSubAtividadeAcumulado = 0;
        
        if (faseAtualIndex < projetoData.length) {
            atualizarDetalhesAtividade(projetoData[faseAtualIndex]); 
        } else {
             atualizarKPIs(); 
             pararSimulacao();
             return;
        }
        subAtividadeAtual = projetoData[faseAtualIndex].atividades_detalhadas[subAtividadeAtualIndex]; // Pega a primeira da nova fase
    }


    const fatorProdutividade = (0.9 + Math.random() * 0.2); 
    const desvioCusto = 1.0 + (Math.random() - 0.5) * 0.04; 

    // AVANÇO GERAL:
    const avancoGlobal = 1.0 * fatorProdutividade * velocidadeSimulacao; 

    // 1. CÁLCULO DE CUSTOS E PROGRESSO DA SUB-ATIVIDADE
    const custoPrevistoDaFase = faseAtual.custo_previsto;
    const pesoSubAtividade = subAtividadeAtual.peso_interno_percentual / 100;
    const custoPrevistoSubAtividadeTotal = custoPrevistoDaFase * pesoSubAtividade;
    
    // Avanço real (em %) dentro da sub-atividade 
    progressoSubAtividade += avancoGlobal; 
    
    // Custo a ser acumulado para este tick (aplicando o desvio de custo)
    const custoPassoPrevisto = (custoPrevistoSubAtividadeTotal / 100) * avancoGlobal;
    const custoPassoReal = custoPassoPrevisto * desvioCusto; 
    
    custoAcumulado += custoPassoReal;
    custoSubAtividadeAcumulado += custoPassoReal;
    
    // 2. TRANSIÇÃO DE SUB-ATIVIDADES
    if (progressoSubAtividade >= 100) {
        progressoSubAtividade = 0;
        subAtividadeAtualIndex++;
        custoSubAtividadeAcumulado = 0; // Zera o acumulado para a próxima sub-atividade

        if (subAtividadeAtualIndex < faseAtual.atividades_detalhadas.length) {
             atualizarDetalhesAtividade(faseAtual); 
        }
    }
    
    // 3. ATUALIZAÇÃO DO PROGRESSO DE FASE E GERAL
    const progressoDasSubAtividadesAnteriores = faseAtual.atividades_detalhadas.slice(0, subAtividadeAtualIndex)
        .reduce((acc, item) => acc + item.peso_interno_percentual, 0);
        
    const progressoInternoAtual = progressoSubAtividade > 100 ? 100 : progressoSubAtividade;

    progressoFase = progressoDasSubAtividadesAnteriores + (progressoInternoAtual * pesoSubAtividade);

    const pesoFasesAnteriores = projetoData.slice(0, faseAtualIndex).reduce((acc, item) => acc + item.peso_percentual, 0);
    progressoGeral = pesoFasesAnteriores + (progressoFase / 100) * faseAtual.peso_percentual;
    
    // Se a fase terminou, garante 100%
    if (subAtividadeAtualIndex >= faseAtual.atividades_detalhadas.length) {
        progressoFase = 100;
    }


    atualizarKPIs();
    // NOVO: Atualiza o detalhe do custo da sub-atividade atual.
    if (subAtividadeAtual) {
        atualizarDetalheCustoSubAtividade(subAtividadeAtual, custoPrevistoSubAtividadeTotal);
    }
}


// Função para popular a lista de atividades detalhadas
function atualizarDetalhesAtividade(fase) {
    const listaUl = document.getElementById('lista-atividades-fase');
    listaUl.innerHTML = ''; 

    document.getElementById('detalhe-atividade').textContent = fase.nome;
    
    fase.atividades_detalhadas.forEach((atividade, index) => {
        const li = document.createElement('li');
        li.textContent = atividade.nome;
        li.id = `sub-atividade-${fase.id}-${index}`;
        
        if (index < subAtividadeAtualIndex) {
            li.style.textDecoration = 'line-through';
            li.style.color = '#666';
        } else if (index === subAtividadeAtualIndex) {
            li.style.fontWeight = 'bold';
            li.style.color = varColor('senai'); // Cor SENAI para a atual
        }

        listaUl.appendChild(li);
    });

    document.getElementById('detalhe-recurso').textContent = fase.recursos_chave.join(', ');
    document.getElementById('detalhe-fornecedor').textContent = fase.fornecedor_chave;
}

// NOVO: Função para atualizar a variação de custo em tempo real por sub-atividade
function atualizarDetalheCustoSubAtividade(subAtividade, custoPrevistoTotal) {
    if (!subAtividade || progressoSubAtividade === 0) return;

    // Custo Planejado até o momento (baseado no progresso)
    const custoPlanejadoAcumulado = custoPrevistoTotal * (progressoSubAtividade / 100);
    
    // Custo Real - Custo Planejado (AC - PV)
    const variacaoCustoSubAtividade = custoSubAtividadeAcumulado - custoPlanejadoAcumulado;

    const sinal = variacaoCustoSubAtividade >= 0 ? '+' : '';
    const isOverBudget = variacaoCustoSubAtividade > 1000; // Define risco se desvio for maior que R$ 1000
    const classeStatus = isOverBudget ? 'status-risco' : (variacaoCustoSubAtividade < -1000 ? 'status-alerta' : 'status-sucesso');
    const corTexto = isOverBudget ? 'var(--cor-risco)' : (variacaoCustoSubAtividade < -1000 ? 'var(--cor-alerta)' : 'var(--cor-sucesso)');
    
    const liEmExecucao = document.getElementById(`sub-atividade-${projetoData[faseAtualIndex].id}-${subAtividadeAtualIndex}`);

    if (liEmExecucao) {
         // Mantém o destaque visual da lista para a atividade atual
         liEmExecucao.style.backgroundColor = 'var(--cor-destaque)';
         liEmExecucao.style.color = 'var(--cor-texto)';
         liEmExecucao.style.fontWeight = 'bold';
         
         // Injetando o detalhe do custo na lista da sub-atividade
         liEmExecucao.innerHTML = `
            ${subAtividade.nome} 
            <span class="sub-atividade-custo" style="float:right; font-weight: bold; font-size: 1.0em; color: ${corTexto}">
                ${sinal}${formatarValor(variacaoCustoSubAtividade)}
            </span>
         `;
    }
}

function atualizarKPIs() {
    // ... (Lógica de atualização dos KPIs, mantida) ...

    const valorAgregado = (progressoGeral / PESO_TOTAL) * CUSTO_TOTAL_PREVISTO; // EV
    const valorPlanejadoFase = projetoData[faseAtualIndex] ? (projetoData[faseAtualIndex].custo_previsto / 100) * progressoFase : 0;
    const valorPlanejadoAcumulado = projetoData.slice(0, faseAtualIndex).reduce((acc, item) => acc + item.custo_previsto, 0) + valorPlanejadoFase; // PV

    const variacaoCusto = custoAcumulado - valorAgregado;
    const percentualVariacao = (variacaoCusto / valorAgregado) * 100 || 0;
    
    // -- KPI 1: Andamento Físico --
    document.getElementById('kpi-andamento').textContent = `${progressoGeral.toFixed(1)}%`;
    
    if (faseAtualIndex < projetoData.length) {
        document.getElementById('fase-atual').textContent = `Fase: ${projetoData[faseAtualIndex].nome} (${progressoFase.toFixed(0)}%)`;
    } else {
        document.getElementById('fase-atual').textContent = `Projeto CONCLUÍDO!`;
    }

    // -- KPI 2: Variação de Custo (PROJETO TOTAL) --
    const sinal = percentualVariacao >= 0 ? '+' : '';
    document.getElementById('kpi-custo').textContent = `${formatarValor(custoAcumulado)} (${sinal}${percentualVariacao.toFixed(1)}%)`;
    
    const custoStatus = document.getElementById('status-custo');
    if (percentualVariacao > 5) { // Maior que 5% acima do orçado
        custoStatus.textContent = 'Alto Desvio Negativo';
        custoStatus.className = 'status-badge status-risco';
    } else if (percentualVariacao > 0) {
        custoStatus.textContent = 'Desvio Leve (Atenção)';
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