export const TRANSACTION_TABLE_CONFIG = {
  header: {
    rowClass: "h-8 bg-slate-100",
    cellClass: "py-1.5 text-[11px] font-semibold"
  },
  body: {
    rowClass: "h-7",
    cellClass: "py-1 text-[11px]",
    evenRowClass: "bg-white hover:bg-slate-50",
    oddRowClass: "bg-slate-50/50 hover:bg-slate-100"
  },
  columns: [
    {
      id: "date",
      label: "Date",
      width: "w-[90px]",
      align: "left",
      className: "whitespace-nowrap"
    },
    {
      id: "account",
      label: "Account",
      width: "w-[140px]",
      align: "left",
      className: "whitespace-nowrap text-slate-600"
    },
    {
      id: "description",
      label: "Description",
      width: "w-[300px]",
      align: "left",
      className: ""
    },
    {
      id: "amount",
      label: "Amount",
      width: "w-[100px]",
      align: "right",
      className: "whitespace-nowrap"
    },
    {
      id: "contact",
      label: "From/To",
      width: "w-[180px]",
      align: "left",
      className: "text-slate-600"
    },
    {
      id: "category",
      label: "Category",
      width: "w-[180px]",
      align: "left",
      className: "text-slate-600"
    },
    {
      id: "action",
      label: "Action",
      width: "w-[80px]",
      align: "left",
      className: ""
    }
  ],
  editField: {
    inputClass: "w-full h-6 text-[11px] px-2 border rounded focus:outline-none focus:ring-1 focus:ring-blue-500",
    dropdownClass: "h-6 text-[11px] w-full",
    buttonClass: "text-left hover:bg-slate-100 px-1 py-0.5 rounded transition-colors w-full text-[11px] truncate block"
  },
  actionButtons: {
    cancelClass: "text-slate-400 hover:text-red-600 transition-colors",
    saveClass: "text-slate-400 hover:text-green-600 transition-colors disabled:opacity-50",
    undoClass: "h-auto p-0 text-blue-600 hover:text-blue-700 text-[11px]"
  }
};

export function getRowClassName(index) {
  const { body } = TRANSACTION_TABLE_CONFIG;
  return `${body.rowClass} ${
    index % 2 === 0 ? body.evenRowClass : body.oddRowClass
  }`;
}

export function getHeaderCellClassName(column) {
  const { header } = TRANSACTION_TABLE_CONFIG;
  const alignClass = column.align === 'right' ? 'text-right' : '';
  return `${column.width} ${header.cellClass} ${alignClass}`;
}

export function getBodyCellClassName(column) {
  const { body } = TRANSACTION_TABLE_CONFIG;
  const alignClass = column.align === 'right' ? 'text-right' : '';
  return `${column.width} ${body.cellClass} ${column.className} ${alignClass}`;
}
