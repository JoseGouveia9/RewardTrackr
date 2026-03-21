export function DonateSection() {
  return (
    <section className="donate-section">
      <p className="donate-title">Support the project</p>
      <p className="donate-sub">
        Donations help cover API costs and keep this tool free and unrestricted.
      </p>
      <div className="donate-addresses">
        <div className="donate-group">
          <span className="donate-label">GOMINING Token / GMT · BEP-20 / ERC-20</span>
          <code className="donate-addr">
            0x02B80404866B5177d78D1178E910Ea4788656088
          </code>
        </div>
        <div className="donate-group">
          <span className="donate-label">GOMINING Token / GMT · TON</span>
          <code className="donate-addr">
            UQAaNd7PzffMT7PY0wJNSOqp9wld2oDmxcSGWHQrnDlt1DIN
          </code>
        </div>
        <div className="donate-group">
          <span className="donate-label">GOMINING Token / GMT · SOL</span>
          <code className="donate-addr">
            2BmjP1zawQ1iHe5a5NtT4MUz4EojLkj7DcZQE52pAAPs
          </code>
        </div>
        <div className="donate-group">
          <span className="donate-label">BTC</span>
          <code className="donate-addr">
            bc1qkfftx7v669cqk7jr68fnkp73wmlq9pvp3fvu3s
          </code>
        </div>
      </div>
    </section>
  );
}
