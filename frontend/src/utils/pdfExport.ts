import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * 导出比赛报告为PDF
 * @param elementId 要导出的元素ID
 * @param filename PDF文件名
 */
export const exportGameReportToPDF = async (elementId: string, filename: string = '比赛报告') => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('找不到要导出的元素');
  }

  try {
    // 显示加载提示
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'pdf-loading';
    loadingMessage.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      z-index: 10000;
      font-size: 16px;
    `;
    loadingMessage.textContent = '正在生成PDF...';
    document.body.appendChild(loadingMessage);

    // 使用html2canvas将元素转换为canvas
    const canvas = await html2canvas(element, {
      scale: 2, // 提高清晰度
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // 移除加载提示
    document.body.removeChild(loadingMessage);

    // 计算PDF尺寸
    const imgWidth = 210; // A4宽度（mm）
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF('p', 'mm', 'a4');

    // 如果内容超过一页，需要分页
    const pageHeight = 297; // A4高度（mm）
    let heightLeft = imgHeight;
    let position = 0;

    // 添加第一页
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 如果内容超过一页，添加更多页
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 保存PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('导出PDF失败:', error);
    throw error;
  }
};

