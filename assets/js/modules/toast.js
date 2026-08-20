/**
 * Toasts leves (SweetAlert2) para confirmações rápidas que não exigem
 * nenhuma decisão do usuário (cadastro, atualização, ativação/inativação e
 * exclusão bem-sucedidos). Reserva o SweetAlert2 "modal grande" só para o
 * que realmente precisa de atenção ou de uma decisão (erros, confirmações
 * antes de uma ação irreversível, fechamento de ticket com opção de
 * comprovante etc.).
 */

const ToastParkGestao =
  typeof Swal !== 'undefined'
    ? Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        didOpen: toastEl => {
          toastEl.addEventListener('mouseenter', Swal.stopTimer)
          toastEl.addEventListener('mouseleave', Swal.resumeTimer)
        }
      })
    : null

function toastParkGestao (icon, titulo) {
  if (!ToastParkGestao) return
  ToastParkGestao.fire({ icon, title: titulo })
}

function toastSucesso (titulo) {
  toastParkGestao('success', titulo)
}

function toastInfo (titulo) {
  toastParkGestao('info', titulo)
}

window.toastSucesso = toastSucesso
window.toastInfo = toastInfo
