import pandas as pd
import duckdb
from cardpay_reward_programs.rule import Rule

class DummyRule(Rule):
    """
    This rules rewards acounts with 
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(DummyRule, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(
        self,
        token,
        base_reward,
        transaction_factor, #not used, just for compatibility with parameters.json
        spend_factor, #not used, just for compatibility with parameters.json
        duration  
    ):
        self.token = token 
        self.base_reward = base_reward
        self.duration = duration
        
    def sql(self, table_query):
        return f"""
            select merchant_safe as payee from {table_query} limit 10;
        """

    # def sql_2(self, table_query, table_query2):
    #     return f"""
    #         select merchant_safe as payee, _block_number
	#              from {table_query}
	#              where _block_number > $1::integer
	#              and _block_number < $2::integer
	#             and historic_spend_balance_uint64 > 100000
    #     """
    
    def sql_2(self, table_query, table_query2):  #table_query = safe_owner, table_query2 = spend_accumulation
        #Refactor this query select and check join vs in sql 
        # how do I refactor sgd1 
        # Why coma instead of join
        return f""" 
            with merchant_safes as (
 	            select merchant_safe, _block_number
	            from {table_query}
	            where _block_number > $1::integer
	            and _block_number < $2::integer
	            and historic_spend_balance_uint64 > 100000
            ),
            final_safes as (
                select merchant_safe,
                max(_block_number)
                from merchant_safes
                group by 1      
            )
            select safe.owner as payee from {table_query2} as safe, 
                final_safes as f_s
                where f_s.merchant_safe = safe.safe;
        """

    def run(self, payment_cycle: int, reward_program_id: str):
        vars = [
            self.start_block,
            self.end_block
            # 17265697,
            # 21986688
        ]

        spend_accumulation_table = self._get_table_query(
            "spend_accumulation", 
            "spend_accumulation", 
            self.start_block,
            self.end_block
        )
        
        safe_owner_table = self._get_table_query(
            "safe_owner", 
            "safe_owner",
            self.start_block,
            self.end_block
        )
        
        if safe_owner_table == "parquet_scan([])" or spend_accumulation_table == "parquet_scan([])":
            df = pd.DataFrame(columns=[])
            print("file empty!")
        else:
            # df = self.run_query(table_query, vars)
            con = duckdb.connect(database=":memory:", read_only=False) 
            con.execute(self.sql_2(spend_accumulation_table, safe_owner_table), vars)
            df = con.fetchdf()


        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = self.base_reward

        print(df)

        return df