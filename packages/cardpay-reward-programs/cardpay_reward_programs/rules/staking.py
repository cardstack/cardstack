import pandas as pd
from cardpay_reward_programs.rule import Rule


class Staking(Rule):
    """
    This rule rewards users with CARD.cpxd held in a depot in a monthly basis
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(Staking, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(self, token, duration, interest_rate_monthly):
        self.token = token
        self.duration = duration
        self.interest_rate_monthly = interest_rate_monthly

    def sql(self, table_query, aux_table_query):
        token_holder_table = table_query
        safe_owner_table = aux_table_query
        return f"""
            -- Select only the safes we are rewarding, and their owner at the end of the cycle
            with filtered_safes AS (
                SELECT safe, max(owner) as owner
                FROM {safe_owner_table} a
                WHERE _block_number = (
                    SELECT MAX(_block_number)
                    FROM {safe_owner_table} b
                    WHERE a.safe = b.safe
                    AND _block_number::integer < $2::integer
                )
                AND type = 'depot'
                GROUP BY safe
            ),
            -- Get the balance history of the safes we are interested in, filtered to the token,
            -- joining to get the owner
            filtered_balances AS (
                SELECT tht.safe, sot.owner, tht.balance_downscale_e9_uint64::int64 AS balance_int64, tht._block_number
                FROM {token_holder_table} AS tht
                LEFT JOIN filtered_safes AS sot ON (tht.safe = sot.safe)
                WHERE token = $3::text
                AND sot.safe IS NOT NULL
            ),
            -- Get the deposits & withdrawals by comparing balances to the previous balance
            balance_changes AS (
                SELECT
                    safe,
                    owner,
                    -- Get the change by subtracting the balance before
                    balance_int64 - LAG(balance_int64, 1 ,0) OVER (PARTITION BY safe ORDER BY _block_number asc) AS change,
                    $5::float+1 AS interest_rate,
                    -- This is the proportion of the 'month' remaining
                    ($2::integer - _block_number::integer) / $4::float AS compounding_periods,
                FROM filtered_balances
                WHERE _block_number::integer < $2::integer
                QUALIFY _block_number::integer >= $1::integer
                ),
            original_balances AS (
                SELECT
                    safe,
                    owner,
                    -- There is only one value here after the group but logically it is the "last" balance
                    -- it is called "change" to match the balance_changes CTE so we can union them together
                    LAST(balance_int64) AS change,
                    $5::float+1 AS interest_rate,
                    1 AS compounding_periods,
                FROM filtered_balances a
                WHERE _block_number::integer < $1::integer
                AND _block_number = (
                    SELECT MAX(_block_number)
                    FROM filtered_balances b
                    WHERE a.safe = b.safe
                    AND _block_number::integer < $1::integer
                )
                GROUP BY safe, owner
                ),

            -- Combine the balances at the start of the period and
            all_data AS (SELECT * FROM original_balances UNION ALL SELECT * FROM balance_changes)

            -- Aggregate the changes, each is treated as a compounding interest calculation
            -- rate^(periods) gives you the total after growth, so we need to take 1 away to get just the growth
            -- e.g. 5% APR for two years would be 1.05^2 - 1
            -- and 5% APR for half a year would be 1.05^(1/2) - 1
            SELECT owner AS payee, sum(change * ((interest_rate**compounding_periods) - 1)) AS rewards
            FROM all_data
            GROUP BY payee
        """

    def run(self, payment_cycle: int, reward_program_id: str):
        start_block, end_block = (
            payment_cycle - self.payment_cycle_length,
            payment_cycle,
        )
        vars = [
            start_block,  # $1 -> int
            end_block,  # $2 -> int
            self.token,  # $3 -> str
            self.payment_cycle_length,  # $4 -> int
            self.interest_rate_monthly,  # $5 -> float
        ]

        table_query = self._get_table_query(
            "token_holder", "token_holder", None, payment_cycle
        )

        aux_table_query = self._get_table_query(
            "safe_owner", "safe_owner", None, payment_cycle
        )

        if table_query == "parquet_scan([])" or aux_table_query == "parquet_scan([])":
            df = pd.DataFrame(columns=["payee", "rewards"])
        else:
            df = self.run_query(table_query, vars, aux_table_query)
        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = df["rewards"] * 1_000_000_000
        df.drop(["rewards"], axis=1)
        return df
