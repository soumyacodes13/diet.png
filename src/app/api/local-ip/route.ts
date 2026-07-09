import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';

  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];
        if (alias.family === 'IPv4' && !alias.internal) {
          localIp = alias.address;
          break;
        }
      }
    }
    if (localIp !== 'localhost') {
      break;
    }
  }

  return NextResponse.json({ ip: localIp });
}
