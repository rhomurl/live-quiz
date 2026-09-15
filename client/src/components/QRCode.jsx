import { QRCodeSVG } from 'qrcode.react';
export default function QRCode({ value }) { return <div className="qr-code">{value && <QRCodeSVG value={value} size={240} level="M" includeMargin title="QR code for the quiz join link" />}<p className="break-anywhere">{value}</p></div>; }
