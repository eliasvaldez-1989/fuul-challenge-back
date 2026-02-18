
export class Money {
  static readonly WEI_PER_ETH = 10n ** 18n;

  private constructor(private readonly wei: bigint) {
    if (wei < 0n) {
      throw new MoneyError('Money cannot be negative');
    }
  }

  static zero(): Money {
    return new Money(0n);
  }

  static fromWei(wei: bigint): Money {
    return new Money(wei);
  }

  static fromEth(eth: bigint): Money {
    return new Money(eth * Money.WEI_PER_ETH);
  }

  static fromEthDecimal(ethStr: string): Money {
    if (!ethStr || !/^\d+(\.\d+)?$/.test(ethStr)) {
      throw new MoneyError(`Invalid ETH decimal string: "${ethStr}"`);
    }

    const parts = ethStr.split('.');
    const wholePart = BigInt(parts[0]);
    let wei = wholePart * Money.WEI_PER_ETH;

    if (parts[1]) {
      const decimals = parts[1].slice(0, 18);
      const padded = decimals.padEnd(18, '0');
      wei += BigInt(padded);
    }

    return new Money(wei);
  }

  add(other: Money): Money {
    return new Money(this.wei + other.wei);
  }

  subtract(other: Money): Money {
    return new Money(this.wei - other.wei);
  }

  multiply(quantity: bigint): Money {
    return new Money(this.wei * quantity);
  }

  applyPercentage(percentage: bigint): Money {
    if (percentage < 0n || percentage > 100n) {
      throw new MoneyError('Percentage must be 0-100');
    }
    return new Money((this.wei * percentage) / 100n);
  }

  isGreaterThan(other: Money): boolean {
    return this.wei > other.wei;
  }

  isLessThan(other: Money): boolean {
    return this.wei < other.wei;
  }

  isEqual(other: Money): boolean {
    return this.wei === other.wei;
  }

  isZero(): boolean {
    return this.wei === 0n;
  }

  static min(a: Money, b: Money): Money {
    return a.wei <= b.wei ? a : b;
  }

  toWei(): bigint {
    return this.wei;
  }

  toEthString(): string {
    const wholePart = this.wei / Money.WEI_PER_ETH;
    const remainder = this.wei % Money.WEI_PER_ETH;
    if (remainder === 0n) return `${wholePart} ETH`;
    const decimals = remainder.toString().padStart(18, '0').slice(0, 5).replace(/0+$/, '');
    return `${wholePart}.${decimals} ETH`;
  }

  toString(): string {
    return this.toEthString();
  }
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}
