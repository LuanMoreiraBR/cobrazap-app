import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { formatCurrency, formatDate } from './format'

function getNowBR() {
  return new Date().toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function sanitizeFileName(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function getChargeStatus(charge) {
  if (charge.computedStatus) return charge.computedStatus
  if (charge.status === 'pago') return 'pago'

  if (!charge.due_date) return charge.status || 'pendente'

  const today = new Date()
  const due = new Date(charge.due_date + 'T00:00:00')
  const todayWithoutTime = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )

  if (due < todayWithoutTime) return 'atrasado'

  return charge.status || 'pendente'
}

function getStatusLabel(status) {
  if (status === 'pago') return 'Pago'
  if (status === 'atrasado') return 'Atrasado'
  return 'Em aberto'
}

function getPaymentTypeLabel(charge) {
  if (charge.payment_type === 'installment') {
    return `Parcela ${charge.installment_number || '-'} de ${
      charge.installment_total || '-'
    }`
  }

  if (charge.recurrence_type === 'monthly') {
    return `Recorrente ${charge.recurrence_number || '-'} de ${
      charge.recurrence_total || '-'
    }`
  }

  return 'À vista'
}

function getPaymentMethodLabel(charge) {
  if (charge.credit_card_enabled) return 'Pix + Cartão'
  return 'Pix'
}

function getPaymentGeneratedLabel(charge) {
  if (charge.payment_url || charge.pix_qr_code) return 'Sim'
  return 'Não'
}

function getSupportContactsLabel(charge) {
  const contacts = Array.isArray(charge.support_whatsapp_contacts)
    ? charge.support_whatsapp_contacts
    : []

  if (!contacts.length) return '-'

  return contacts
    .map((contact) => {
      const name = contact.name || contact.label || 'Atendimento'
      const phone = String(contact.phone || '').replace(/\D/g, '')
      return `${name}: +${phone}`
    })
    .join('\n')
}

function getReportRows(charges) {
  return (charges || []).map((charge) => {
    const status = getChargeStatus(charge)

    return {
      cliente: charge.client?.name || 'Cliente não informado',
      telefone: charge.client?.phone || '',
      descricao: charge.description || '',
      valor: Number(charge.amount || 0),
      vencimento: charge.due_date || '',
      status,
      statusLabel: getStatusLabel(status),
      tipo: getPaymentTypeLabel(charge),
      pagamento: getPaymentMethodLabel(charge),
      pagamentoGerado: getPaymentGeneratedLabel(charge),
      enviadoWhatsapp: charge.whatsapp_sent_at ? 'Sim' : 'Não',
      contatosDuvidas: getSupportContactsLabel(charge),
      linkPagamento: charge.payment_url || '',
    }
  })
}

function getSummary(rows) {
  const total = rows.length
  const emAberto = rows.filter((row) => row.status === 'pendente').length
  const atrasadas = rows.filter((row) => row.status === 'atrasado').length
  const pagas = rows.filter((row) => row.status === 'pago').length

  const valorTotal = rows.reduce((acc, row) => acc + Number(row.valor || 0), 0)

  const valorEmAberto = rows
    .filter((row) => row.status === 'pendente' || row.status === 'atrasado')
    .reduce((acc, row) => acc + Number(row.valor || 0), 0)

  const valorPago = rows
    .filter((row) => row.status === 'pago')
    .reduce((acc, row) => acc + Number(row.valor || 0), 0)

  const valorAtrasado = rows
    .filter((row) => row.status === 'atrasado')
    .reduce((acc, row) => acc + Number(row.valor || 0), 0)

  return {
    total,
    emAberto,
    atrasadas,
    pagas,
    valorTotal,
    valorEmAberto,
    valorPago,
    valorAtrasado,
  }
}

async function loadImageAsDataUrl(src) {
  const response = await fetch(src)
  const blob = await response.blob()

  return await new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getUserLabel(user) {
  return user?.email || user?.user_metadata?.name || user?.id || 'Usuário'
}

export async function exportChargesToPdf({
  charges,
  user,
  periodLabel = 'Período selecionado',
  filePrefix = 'relatorio-cobrancas-lembrei',
}) {
  const rows = getReportRows(charges)
  const summary = getSummary(rows)
  const emittedBy = getUserLabel(user)
  const emittedAt = getNowBR()

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  let logoDataUrl = null

  try {
    logoDataUrl = await loadImageAsDataUrl('/relat.png')
  } catch (error) {
    console.warn('Não foi possível carregar logo para PDF:', error)
  }

  doc.setFillColor(7, 13, 45)
  doc.rect(0, 0, pageWidth, 92, 'F')

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 36, 22, 48, 48)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Cobranças', 100, 42)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Lembrei - Gestão de recebimentos e cobranças por WhatsApp', 100, 62)

  doc.setFontSize(9)
  doc.text(`Emitido em: ${emittedAt}`, pageWidth - 220, 36)
  doc.text(`Emitido por: ${emittedBy}`, pageWidth - 220, 52)
  doc.text(`Filtro: ${periodLabel}`, pageWidth - 220, 68)

  const summaryCards = [
    ['Total', String(summary.total)],
    ['Em aberto', String(summary.emAberto)],
    ['Atrasadas', String(summary.atrasadas)],
    ['Pagas', String(summary.pagas)],
    ['Valor em aberto', formatCurrency(summary.valorEmAberto)],
    ['Valor pago', formatCurrency(summary.valorPago)],
  ]

  let x = 36
  const y = 116
  const cardWidth = 120
  const cardHeight = 50

  summaryCards.forEach(([label, value]) => {
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, y, cardWidth, cardHeight, 10, 10, 'FD')

    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(label, x + 12, y + 18)

    doc.setTextColor(7, 13, 45)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(value, x + 12, y + 36)

    x += cardWidth + 12
  })

  autoTable(doc, {
    startY: 190,
    head: [
      [
        'Cliente',
        'Telefone',
        'Descrição',
        'Valor',
        'Vencimento',
        'Status',
        'Tipo',
        'Pagamento',
        'Gerado',
        'WhatsApp',
        'Dúvidas',
      ],
    ],
    body: rows.map((row) => [
      row.cliente,
      row.telefone,
      row.descricao,
      formatCurrency(row.valor),
      row.vencimento ? formatDate(row.vencimento) : '-',
      row.statusLabel,
      row.tipo,
      row.pagamento,
      row.pagamentoGerado,
      row.enviadoWhatsapp,
      row.contatosDuvidas,
    ]),
    styles: {
      fontSize: 7,
      cellPadding: 5,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [91, 75, 255],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 82 },
      1: { cellWidth: 70 },
      2: { cellWidth: 120 },
      3: { cellWidth: 58, halign: 'right' },
      4: { cellWidth: 58 },
      5: { cellWidth: 58 },
      6: { cellWidth: 72 },
      7: { cellWidth: 62 },
      8: { cellWidth: 45 },
      9: { cellWidth: 50 },
      10: { cellWidth: 100 },
    },
    margin: {
      left: 36,
      right: 36,
    },
    didDrawPage: () => {
      const pageNumber = doc.internal.getNumberOfPages()

      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Lembrei - Relatório Gerencial | Página ${pageNumber}`,
        36,
        pageHeight - 22,
      )
    },
  })

  const fileName = `${sanitizeFileName(filePrefix)}-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`

  doc.save(fileName)
}

export async function exportChargesToExcel({
  charges,
  user,
  periodLabel = 'Período selecionado',
  filePrefix = 'relatorio-cobrancas-lembrei',
}) {
  const rows = getReportRows(charges)
  const summary = getSummary(rows)
  const emittedBy = getUserLabel(user)
  const emittedAt = getNowBR()

  const workbook = new ExcelJS.Workbook()

  workbook.creator = 'Lembrei'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheet = workbook.addWorksheet('Relatório de Cobranças', {
    views: [{ state: 'frozen', ySplit: 12 }],
  })

  sheet.properties.defaultRowHeight = 20

  // Aumenta altura das linhas do cabeçalho para acomodar o logo (90px)
  sheet.getRow(1).height = 28
  sheet.getRow(2).height = 28
  sheet.getRow(3).height = 28
  sheet.getRow(4).height = 28

  sheet.columns = [
    { key: 'cliente', width: 28 },
    { key: 'telefone', width: 18 },
    { key: 'descricao', width: 36 },
    { key: 'valor', width: 14 },
    { key: 'vencimento', width: 14 },
    { key: 'statusLabel', width: 14 },
    { key: 'tipo', width: 22 },
    { key: 'pagamento', width: 16 },
    { key: 'pagamentoGerado', width: 14 },
    { key: 'enviadoWhatsapp', width: 16 },
    { key: 'contatosDuvidas', width: 34 },
    { key: 'linkPagamento', width: 52 },
  ]

  // ✅ CORREÇÃO: preenche o fundo ANTES de mesclar, sem sobreposição de ranges
  for (let row = 1; row <= 4; row += 1) {
    for (let col = 1; col <= 12; col += 1) {
      const cell = sheet.getCell(row, col)

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF070D2D' },
      }
    }
  }

  // Título ocupa B1:L2 | subtítulo ocupa B3:L4 | coluna A fica livre para o logo
  sheet.mergeCells('B1:L2')

  const titleCell = sheet.getCell('B1')
  titleCell.value = 'Relatório de Cobranças'
  titleCell.font = {
    name: 'Arial',
    size: 22,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  }
  titleCell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
  }

  sheet.mergeCells('B3:L4')
  const subtitleCell = sheet.getCell('B3')
  subtitleCell.value = 'Lembrei - Gestão de recebimentos e cobranças por WhatsApp'
  subtitleCell.font = {
    name: 'Arial',
    size: 11,
    color: { argb: 'FFE2E8F0' },
  }
  subtitleCell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
  }

  try {
    const logoDataUrl = await loadImageAsDataUrl('/relat.png')
    const base64 = String(logoDataUrl).split(',')[1]

    const imageId = workbook.addImage({
      base64,
      extension: 'png',
    })

    // Logo 1024x1024 — centralizado horizontal e verticalmente nas 4 linhas do cabeçalho
    sheet.addImage(imageId, {
      tl: { col: 0.27, row: 0.8 },
      ext: { width: 90, height: 90 },
    })
  } catch (error) {
    console.warn('Não foi possível carregar logo para Excel:', error)
  }

  sheet.getCell('A6').value = 'Emitido em'
  sheet.getCell('B6').value = emittedAt
  sheet.getCell('A7').value = 'Emitido por'
  sheet.getCell('B7').value = emittedBy
  sheet.getCell('A8').value = 'Filtro'
  sheet.getCell('B8').value = periodLabel

  ;['A6', 'A7', 'A8'].forEach((cellAddress) => {
    const cell = sheet.getCell(cellAddress)
    cell.font = { bold: true, color: { argb: 'FF070D2D' } }
  })

  const summaryStartRow = 6
  const summaryData = [
    ['Total', summary.total],
    ['Em aberto', summary.emAberto],
    ['Atrasadas', summary.atrasadas],
    ['Pagas', summary.pagas],
    ['Valor em aberto', summary.valorEmAberto],
    ['Valor pago', summary.valorPago],
  ]

  summaryData.forEach(([label, value], index) => {
    const col = 4 + index
    const labelCell = sheet.getCell(summaryStartRow, col)
    const valueCell = sheet.getCell(summaryStartRow + 1, col)

    labelCell.value = label
    valueCell.value = value

    labelCell.font = { bold: true, color: { argb: 'FF64748B' } }
    valueCell.font = { bold: true, size: 13, color: { argb: 'FF070D2D' } }

    labelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    }
    valueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    }

    labelCell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }
    valueCell.border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    }

    if (String(label).toLowerCase().includes('valor')) {
      valueCell.numFmt = '"R$" #,##0.00'
    }
  })

  const headerRowNumber = 11

  const headers = [
    'Cliente',
    'Telefone',
    'Descrição',
    'Valor',
    'Vencimento',
    'Status',
    'Tipo',
    'Pagamento',
    'Pagamento gerado',
    'WhatsApp enviado',
    'Dúvidas',
    'Link de pagamento',
  ]

  sheet.getRow(headerRowNumber).values = headers

  const headerRow = sheet.getRow(headerRowNumber)

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5B4BFF' },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF5B4BFF' } },
      left: { style: 'thin', color: { argb: 'FF5B4BFF' } },
      bottom: { style: 'thin', color: { argb: 'FF5B4BFF' } },
      right: { style: 'thin', color: { argb: 'FF5B4BFF' } },
    }
  })

  rows.forEach((row) => {
    const excelRow = sheet.addRow([
      row.cliente,
      row.telefone,
      row.descricao,
      row.valor,
      row.vencimento ? formatDate(row.vencimento) : '-',
      row.statusLabel,
      row.tipo,
      row.pagamento,
      row.pagamentoGerado,
      row.enviadoWhatsapp,
      row.contatosDuvidas,
      row.linkPagamento,
    ])

    excelRow.eachCell((cell) => {
      cell.alignment = {
        vertical: 'top',
        wrapText: true,
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
    })

    excelRow.getCell(4).numFmt = '"R$" #,##0.00'

    if (row.status === 'pago') {
      excelRow.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1FAE5' },
      }
    }

    if (row.status === 'atrasado') {
      excelRow.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' },
      }
    }

    if (row.status === 'pendente') {
      excelRow.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' },
      }
    }
  })

  sheet.autoFilter = {
    from: {
      row: headerRowNumber,
      column: 1,
    },
    to: {
      row: headerRowNumber,
      column: headers.length,
    },
  }

  sheet.eachRow((row) => {
    row.height = Math.max(row.height || 20, 22)
  })

  sheet.getColumn(3).alignment = { wrapText: true, vertical: 'top' }
  sheet.getColumn(11).alignment = { wrapText: true, vertical: 'top' }
  sheet.getColumn(12).alignment = { wrapText: true, vertical: 'top' }

  const buffer = await workbook.xlsx.writeBuffer()

  const fileName = `${sanitizeFileName(filePrefix)}-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`

  saveAs(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  )
}